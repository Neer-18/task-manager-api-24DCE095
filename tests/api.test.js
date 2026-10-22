const request = require('supertest');
const app = require('../server');

describe('Task Manager API - CI Automated Test Suite (Practical 12)', () => {

    // Test 1: Public Cache Diagnostics Endpoint (Deliberately failing test for CI failure demonstration)
    test('GET /cache/stats should return 200 and cache diagnostics', async () => {
        const res = await request(app).get('/cache/stats');
        expect(res.statusCode).toBe(500); // Deliberate failure: expecting 500 instead of 200
        expect(res.body).toHaveProperty('status', 'active');
        expect(res.body).toHaveProperty('stdTTL', 60);
        expect(res.body).toHaveProperty('hitRatio');
    });

    // Test 2: Authentication Security Check on Protected Route
    test('GET /tasks without JWT token should return 401 Unauthorized', async () => {
        const res = await request(app).get('/tasks');
        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    // Test 3 (Supplementary): Validation Middleware Check
    test('POST /login with empty body should return 400 Bad Request', async () => {
        const res = await request(app)
            .post('/login')
            .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error', 'Validation Error');
    });

    // Test 4 (Supplementary): 404 Handler for Undefined Endpoints
    test('GET /invalid-endpoint-path should return 404 Not Found', async () => {
        const res = await request(app).get('/invalid-endpoint-path');
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error', 'Not Found');
    });
});
