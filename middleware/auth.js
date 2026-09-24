const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token from the Authorization: Bearer <token> header.
 * Differentiates TokenExpiredError (401) from tampered/invalid tokens (403).
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token expired. Please log in again.'
            });
        }
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or tampered token.'
        });
    }
};

module.exports = { authenticateToken };
