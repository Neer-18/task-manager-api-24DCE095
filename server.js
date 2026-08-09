const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Parse incoming JSON request bodies
app.use(express.json());

// 1. Global Request Logger Middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// 2. Content-Type Validation Middleware
// Rejects POST and PUT requests that do not specify application/json Content-Type
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

// In-Memory Database for Tasks
let tasks = [
    { id: 1, title: "Learn React Hooks", description: "Understand useState, useEffect, and custom hooks", completed: true },
    { id: 2, title: "Build Node REST API", description: "Design a task manager backend using Express", completed: false }
];
let nextId = 3;

// 3. Route-Specific Task ID Validator Middleware
// Validates that :id is a positive integer format before hitting the controller
const validateTaskId = (req, res, next) => {
    const idStr = req.params.id;
    const parsedId = parseInt(idStr, 10);
    
    // Ensure the ID is a valid number, positive, and matches the input string exactly (no decimals or trailing characters)
    if (isNaN(parsedId) || parsedId <= 0 || String(parsedId) !== idStr) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Task ID parameter must be a valid positive integer."
        });
    }
    req.taskId = parsedId; // Pass parsed numeric ID forward
    next();
};

// --- CRUD Endpoints ---

// GET /tasks - Get all tasks
app.get('/tasks', (req, res) => {
    res.status(200).json(tasks);
});

// GET /tasks/:id - Get a specific task by ID
app.get('/tasks/:id', validateTaskId, (req, res) => {
    const task = tasks.find(t => t.id === req.taskId);
    if (!task) {
        return res.status(404).json({
            error: "Not Found",
            message: `Task with ID ${req.taskId} was not found.`
        });
    }
    res.status(200).json(task);
});

// POST /tasks - Create a new task
app.post('/tasks', (req, res) => {
    const { title, description } = req.body;

    // Validate that title exists and is non-empty
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({
            error: "Bad Request",
            message: "Validation Error: 'title' is a required field and must be a non-empty string."
        });
    }

    const newTask = {
        id: nextId++,
        title: title.trim(),
        description: description ? String(description).trim() : "",
        completed: false
    };

    tasks.push(newTask);
    res.status(201).json(newTask);
});

// PUT /tasks/:id - Update an existing task by ID
app.put('/tasks/:id', validateTaskId, (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.taskId);
    if (taskIndex === -1) {
        return res.status(404).json({
            error: "Not Found",
            message: `Task with ID ${req.taskId} was not found.`
        });
    }

    const { title, description, completed } = req.body;

    // Validate fields if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Validation Error: 'title' must be a non-empty string."
        });
    }

    if (completed !== undefined && typeof completed !== 'boolean') {
        return res.status(400).json({
            error: "Bad Request",
            message: "Validation Error: 'completed' must be a boolean."
        });
    }

    // Merge changes
    const updatedTask = {
        ...tasks[taskIndex],
        title: title !== undefined ? title.trim() : tasks[taskIndex].title,
        description: description !== undefined ? String(description).trim() : tasks[taskIndex].description,
        completed: completed !== undefined ? completed : tasks[taskIndex].completed
    };

    tasks[taskIndex] = updatedTask;
    res.status(200).json(updatedTask);
});

// DELETE /tasks/:id - Delete a task by ID
app.delete('/tasks/:id', validateTaskId, (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.taskId);
    if (taskIndex === -1) {
        return res.status(404).json({
            error: "Not Found",
            message: `Task with ID ${req.taskId} was not found.`
        });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];
    res.status(200).json({
        message: "Task successfully deleted.",
        task: deletedTask
    });
});

// GET /simulate-error - Deliberate error endpoint to test the Global Error Handler
app.get('/simulate-error', (req, res, next) => {
    // Throwing error inside a synchronous route handler will automatically pass to next() by Express
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
// Defined last to catch all uncaught exceptions
app.use((err, req, res, next) => {
    console.error(`[Global Error Handler] Stack Trace: ${err.stack}`);
    
    // Send a sanitized error response to the client (omit stack trace for security reasons)
    res.status(500).json({
        error: "Internal Server Error",
        message: "Something went wrong on the server. Please try again later."
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Task Manager API running on port ${PORT}`);
    console.log(`   Local URL: http://localhost:${PORT}`);
});
