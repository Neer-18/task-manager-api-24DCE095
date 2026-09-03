require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Task = require('./models/Task');

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

// --- CRUD Endpoints using Mongoose ---

// GET /tasks - Get all tasks from MongoDB
app.get('/tasks', async (req, res, next) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (err) {
        next(err);
    }
});

// GET /tasks/:id - Get a specific task by ID
app.get('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }
        res.status(200).json(task);
    } catch (err) {
        next(err);
    }
});

// POST /tasks - Create a new task in MongoDB (enforces schema validation)
app.post('/tasks', async (req, res, next) => {
    try {
        const { title, description, priority } = req.body;

        const newTask = new Task({
            title,
            description,
            priority
        });

        const savedTask = await newTask.save();
        res.status(201).json(savedTask);
    } catch (err) {
        next(err);
    }
});

// PUT /tasks/:id - Update an existing task by ID
app.put('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const { title, description, completed, priority, status } = req.body;

        // Support both boolean completed and string status payload updates
        let targetCompleted;
        if (completed !== undefined) {
            targetCompleted = completed;
        } else if (status !== undefined) {
            targetCompleted = (status === 'completed' || status === true);
        }

        // Prepare the updates to apply
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (targetCompleted !== undefined) updateData.completed = targetCompleted;
        if (priority !== undefined) updateData.priority = priority;

        // findByIdAndUpdate with validation run on modifications
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedTask) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }

        res.status(200).json(updatedTask);
    } catch (err) {
        next(err);
    }
});

// DELETE /tasks/:id - Delete a task by ID from MongoDB
app.delete('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);
        if (!deletedTask) {
            return res.status(404).json({
                error: "Not Found",
                message: `Task with ID ${req.params.id} was not found.`
            });
        }
        res.status(200).json({
            message: "Task successfully deleted.",
            task: deletedTask
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
    // Handle Mongoose Validation Error (returns clean, structured JSON detailing failed fields)
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
