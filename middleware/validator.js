/**
 * Server-Side Input Validation Middleware
 * Enforces request data integrity BEFORE requests reach database operations.
 */

const validateRegisterInput = (req, res, next) => {
    const { name, email, password } = req.body;
    const errors = {};

    if (!name || typeof name !== 'string' || name.trim() === '') {
        errors.name = 'Name is required and cannot be empty.';
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!email || !emailRegex.test(email.trim())) {
        errors.email = 'A valid email address is required.';
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        errors.password = 'Password must be at least 6 characters long.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Input validation failed for user registration.',
            details: errors
        });
    }

    next();
};

const validateLoginInput = (req, res, next) => {
    const { email, password } = req.body;
    const errors = {};

    if (!email || typeof email !== 'string' || email.trim() === '') {
        errors.email = 'Email is required.';
    }

    if (!password || typeof password !== 'string' || password === '') {
        errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Input validation failed for user login.',
            details: errors
        });
    }

    next();
};

const validateTaskInput = (req, res, next) => {
    const { title, priority } = req.body;
    const errors = {};

    if (!title || typeof title !== 'string' || title.trim() === '') {
        errors.title = 'Title is a required field and cannot be empty.';
    }

    if (priority && !['low', 'medium', 'high'].includes(priority)) {
        errors.priority = "Priority must be either 'low', 'medium', or 'high'.";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Input validation failed for task.',
            details: errors
        });
    }

    next();
};

module.exports = {
    validateRegisterInput,
    validateLoginInput,
    validateTaskInput
};
