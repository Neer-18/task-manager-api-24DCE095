const EventEmitter = require('events');

/**
 * Dedicated EventEmitter for Task Management System
 * Practical 10: Asynchronous Processing with Event-Driven Architecture
 */
class TaskEvents extends EventEmitter {}

module.exports = new TaskEvents();
