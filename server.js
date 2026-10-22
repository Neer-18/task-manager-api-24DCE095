require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Task = require('./models/Task');
const User = require('./models/User');
const { authenticateToken } = require('./middleware/auth');
const {
    validateRegisterInput,
    validateLoginInput,
    validateTaskInput
} = require('./middleware/validator');
const cache = require('./cache');
const taskEvents = require('./events');
require('./listeners');

// In-Memory Cache Stats Tracking (Practical 9 Supplementary Problem 2)
let cacheHits = 0;
let cacheMisses = 0;

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskmanager';

// Enable CORS for cross-origin requests (e.g. React frontend on localhost:5173)
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('🔌 Connected to MongoDB successfully'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// 1. Global Request Logger Middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// 2. Content-Type Validation Middleware
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                error: "Unsupported Media Type",
                message: "This endpoint requires body content in application/json format. Check your Content-Type header."
            });
        }
    }
    next();
});

// 3. Route-Specific Task ID Validator Middleware
// Validates that :id matches a 24-character hexadecimal MongoDB ObjectId
const validateTaskId = (req, res, next) => {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Task ID parameter must be a valid 24-character hexadecimal MongoDB ObjectId."
        });
    }
    next();
};

// ==========================================
// --- AUTHENTICATION ROUTES (Practical 7) ---
// ==========================================

// POST /register - Register a new user with hashed password
app.post('/register', validateRegisterInput, async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Check for duplicate account
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                error: "Validation Error",
                message: "An account with this email address already exists."
            });
        }

        // Hash password with bcryptjs (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        res.status(201).json({
            message: "User registered successfully.",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /login - Authenticate user and issue signed JWT
app.post('/login', validateLoginInput, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Fine-Tuning 1: Explicitly select '+password' because schema sets select: false
        const user = await User.findOne({ email: normalizedEmail }).select('+password');
        if (!user) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Invalid email or password."
            });
        }

        // Compare input password with stored bcrypt hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Invalid email or password."
            });
        }

        // Generate JWT token with 1-hour expiration
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        next(err);
    }
});

// GET /me - Return currently logged-in user profile (Supplementary Problem 1)
// Protected by authenticateToken middleware
app.get('/me', authenticateToken, async (req, res, next) => {
    try {
        // Password is automatically excluded because of select: false
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                error: "Not Found",
                message: "User account not found."
            });
        }

        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
        });
    } catch (err) {
        next(err);
    }
});

// ===============================================
// --- PROTECTED TASK ROUTES (Middleware Chain) ---
// ===============================================

// ====================================================
// --- IN-MEMORY CACHE DEBUG ENDPOINTS (Practical 9) ---
// ====================================================

// GET /cache/stats - Retrieve real-time cache metrics and hit/miss counts (Supplementary Problem 2)
app.get('/cache/stats', (req, res) => {
    const keys = cache.keys();
    const stats = cache.getStats();
    const total = cacheHits + cacheMisses;
    const hitRatio = total > 0 ? ((cacheHits / total) * 100).toFixed(2) + '%' : '0.00%';

    res.status(200).json({
        status: "active",
        stdTTL: 60,
        totalRequests: total,
        cacheHits,
        cacheMisses,
        hitRatio,
        cachedKeysCount: keys.length,
        cachedKeys: keys,
        nodeCacheStats: stats
    });
});

// POST /cache/flush - Invalidate all cache entries manually (benchmarking helper)
app.post('/cache/flush', (req, res) => {
    cache.flushAll();
    cacheHits = 0;
    cacheMisses = 0;
    res.status(200).json({ message: "In-memory cache successfully flushed." });
});

// ===============================================
// --- PROTECTED TASK ROUTES (Middleware Chain) ---
// ===============================================

// GET /tasks - Get all tasks for authenticated user (In-Memory Cached with 60s TTL)
app.get('/tasks', authenticateToken, async (req, res, next) => {
    try {
        const cacheKey = `tasks_${req.user.id}`;
        const cachedTasks = cache.get(cacheKey);

        if (cachedTasks) {
            cacheHits++;
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cachedTasks);
        }

        // Cache MISS: Query MongoDB Atlas
        cacheMisses++;
        const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });

        // Store query result in cache with 60-second TTL
        cache.set(cacheKey, tasks, 60);

        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(tasks);
    } catch (err) {
        next(err);
    }
});

// GET /tasks/:id - Get a specific task by ID (Cached separately - Supplementary Problem 1)
app.get('/tasks/:id', authenticateToken, validateTaskId, async (req, res, next) => {
    try {
        const cacheKey = `task_${req.params.id}`;
        const cachedTask = cache.get(cacheKey);

        if (cachedTask) {
            // Verify ownership of cached document
            if (cachedTask.user && cachedTask.user.toString() !== req.user.id) {
                return res.status(403).json({
                    error: "Forbidden",
                    message: "You do not have permission to view this task."
                });
            }
            cacheHits++;
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cachedTask);
        }

        // Cache MISS: Query MongoDB Atlas
        cacheMisses++;
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }
        if (task.user && task.user.toString() !== req.user.id) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have permission to view this task."
            });
        }

        // Store single task in cache
        cache.set(cacheKey, task, 60);

        res.setHeader('X-Cache', 'MISS');
        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
});

// POST /tasks - Create a task (Invalidates user's task list cache)
// Sequential middleware order: authenticateToken -> validateTaskInput -> Controller
app.post('/tasks', authenticateToken, validateTaskInput, async (req, res, next) => {
    try {
        const { title, description, priority } = req.body;

        const newTask = new Task({
            title,
            description,
            priority,
            user: req.user.id
        });

        const savedTask = await newTask.save();

        // Invalidate cached task list so newly added task is immediately visible
        cache.del(`tasks_${req.user.id}`);

        // Practical 10: Asynchronous event emission (Response sent immediately before event listener executes)
        console.log(`[API] Response sent at ${new Date().toISOString()} for Task ID: ${savedTask._id}`);
        res.status(201).json(savedTask);

        // Emit 'task-created' event asynchronously without blocking the client response
        setImmediate(() => {
            taskEvents.emit('task-created', savedTask);
        });
    } catch (err) {
        next(err);
    }
});

// PUT /tasks/:id - Update an existing task by ID (Invalidates all_tasks and single task cache)
app.put('/tasks/:id', authenticateToken, validateTaskId, async (req, res, next) => {
    try {
        const existingTask = await Task.findById(req.params.id);
        if (!existingTask) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }
        if (existingTask.user && existingTask.user.toString() !== req.user.id) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have permission to modify this task."
            });
        }

        const { title, description, completed, priority, status } = req.body;

        let targetCompleted;
        if (completed !== undefined) {
            targetCompleted = completed;
        } else if (status !== undefined) {
            targetCompleted = (status === 'completed' || status === true);
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (targetCompleted !== undefined) updateData.completed = targetCompleted;
        if (priority !== undefined) updateData.priority = priority;

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        // Invalidate both the task list and the specific task key to prevent stale reads
        cache.del(`tasks_${req.user.id}`);
        cache.del(`task_${req.params.id}`);

        res.status(200).json(updatedTask);
    } catch (err) {
        next(err);
    }
});

// DELETE /tasks/:id - Delete a task by ID (Invalidates all_tasks and single task cache)
app.delete('/tasks/:id', authenticateToken, validateTaskId, async (req, res, next) => {
    try {
        const existingTask = await Task.findById(req.params.id);
        if (!existingTask) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }
        if (existingTask.user && existingTask.user.toString() !== req.user.id) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have permission to delete this task."
            });
        }

        const deletedTask = await Task.findByIdAndDelete(req.params.id);

        // Invalidate cache immediately on deletion
        cache.del(`tasks_${req.user.id}`);
        cache.del(`task_${req.params.id}`);

        // Practical 10 (Supplementary Problem 1): Asynchronous event emission for task deletion
        console.log(`[API] Delete response sent at ${new Date().toISOString()} for Task ID: ${deletedTask._id}`);
        res.status(200).json({
            message: "Task successfully deleted.",
            task: deletedTask
        });

        // Emit 'task-deleted' event asynchronously
        setImmediate(() => {
            taskEvents.emit('task-deleted', {
                id: deletedTask._id,
                title: deletedTask.title,
                user: req.user.id
            });
        });
    } catch (err) {
        next(err);
    }
});

// GET /simulate-error - Deliberate error endpoint to test the Global Error Handler
app.get('/simulate-error', (req, res, next) => {
    throw new Error("Simulated Server Crash Error.");
});

// 4. Undefined Routes Catch-All Handler (404 Handler)
app.use((req, res, next) => {
    res.status(404).json({
        error: "Not Found",
        message: `The endpoint '${req.originalUrl}' does not exist on this server.`
    });
});

// 5. Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    // Handle Mongoose Validation Error (returns clean, structured JSON)
    if (err.name === 'ValidationError') {
        const details = {};
        for (let key in err.errors) {
            details[key] = err.errors[key].message;
        }
        return res.status(400).json({
            error: "Validation Error",
            message: "Data validation failed.",
            details
        });
    }

    // Handle Mongoose Cast Error (e.g. malformed ObjectId query values)
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: "Bad Request",
            message: `Invalid format for field '${err.path}' value: '${err.value}'.`
        });
    }

    console.error(`[Global Error Handler] Stack Trace: ${err.stack}`);
    
    // Sanitized JSON response for standard uncaught errors
    res.status(err.status || 500).json({
        error: "Internal Server Error",
        message: "Something went wrong on the server. Please try again later."
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Task Manager API running on port ${PORT}`);
    console.log(`   Local URL: http://localhost:${PORT}`);
});
