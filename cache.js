const NodeCache = require('node-cache');

/**
 * Shared In-Memory Cache Instance
 * Practical 9: In-Memory Caching with node-cache
 * stdTTL: 60 seconds (Time-To-Live)
 * checkperiod: 120 seconds (Automatic expired key cleanup)
 */
const cache = new NodeCache({
    stdTTL: 60,
    checkperiod: 120,
    useClones: true
});

module.exports = cache;
