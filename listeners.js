const taskEvents = require('./events');

/**
 * Event Listeners for Task Management
 * Practical 10: Asynchronous Processing with Event-Driven Architecture
 */

// 1. Primary Listener: 'task-created'
// Decouples notifications and side-effects from the main HTTP request/response cycle
taskEvents.on('task-created', (task) => {
    try {
        console.log(`[Listener START] 'task-created' event received at ${new Date().toISOString()} for "${task.title}"`);

        // Check for simulated error condition (Supplementary Problem 2)
        if (task.title && task.title.includes('[SIMULATE_ERROR]')) {
            throw new Error(`Simulated notification failure for task: "${task.title}"`);
        }

        // Simulate a slow asynchronous background notification service (Supplementary Problem 3)
        // e.g., Sending email/SMS via 3rd party API with 2000ms network delay
        setTimeout(() => {
            const completedTimestamp = new Date().toISOString();
            console.log(
                `[Notification COMPLETED] Background notification sent for Task "${task.title}" ` +
                `(ID: ${task._id}, Assigned User: ${task.user}) at ${completedTimestamp}`
            );
        }, 2000);

    } catch (err) {
        // Emit error event to be handled by dedicated error listener (Supplementary Problem 2)
        taskEvents.emit('error', err);
    }
});

// 2. Supplementary Problem 1: 'task-deleted' Listener
// Triggered whenever an existing task is deleted from the database
taskEvents.on('task-deleted', (data) => {
    try {
        console.log(`[Listener START] 'task-deleted' event received at ${new Date().toISOString()} for Task ID: ${data.id}`);

        // Background audit logging simulation
        setTimeout(() => {
            const auditTimestamp = new Date().toISOString();
            console.log(
                `[Audit Log COMPLETED] Task deletion archived for "${data.title}" ` +
                `(ID: ${data.id}, Deleted By User: ${data.user}) at ${auditTimestamp}`
            );
        }, 1500);

    } catch (err) {
        taskEvents.emit('error', err);
    }
});

// 3. Supplementary Problem 2: Dedicated 'error' Event Listener
// In Node.js EventEmitter, an unhandled 'error' event causes the entire process to crash.
// Registering this listener catches background exceptions gracefully.
taskEvents.on('error', (err) => {
    console.error(
        `[TaskEvents ERROR] Gracefully captured event error at ${new Date().toISOString()}:\n` +
        `  Message: ${err.message}`
    );
});

console.log('Task event listeners registered successfully.');
