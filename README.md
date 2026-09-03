# Task Manager RESTful API

A complete RESTful backend API for task management built using **Node.js, Express, and a custom middleware pipeline**.

---

## 🚀 Middleware Pipeline Architecture

The request-response cycle follows a sequential pipeline where incoming payloads are validated, logged, routed, and sanitised before returning a response.

```
Client Request (Postman/cURL)
 │
 ├──► [1. Logging Middleware]          (Logs: Timestamp, HTTP Method, Request Path)
 ├──► [2. Content-Type Check]          (Rejects POST/PUT if not application/json with HTTP 415)
 ├──► [3. Route-Specific ID Validation] (Validates task ID format with HTTP 400)
 ├──► [4. Express Routers / Controllers](Processes CRUD operations on in-memory array)
 │     ├── GET /tasks                  (Retrieves all tasks)
 │     ├── GET /tasks/:id              (Retrieves a task by ID)
 │     ├── POST /tasks                 (Creates a task - validates required fields)
 │     ├── PUT /tasks/:id              (Updates a task by ID)
 │     └── DELETE /tasks/:id           (Deletes a task by ID)
 ├──► [5. Undefined Route Catch-All]   (Intercepts invalid paths, returns HTTP 404 JSON)
 └──► [6. Global Error Handler]        (Catch-all for uncaught exceptions, returns HTTP 500 JSON)
```

---

## 🛠️ API Endpoints Summary

| Method | Endpoint | Description | Status Code (Success) | Status Code (Failure) |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/tasks` | Retrieve list of all tasks | `200 OK` | `500 Server Error` |
| **GET** | `/tasks/:id` | Retrieve details of a task by ID | `200 OK` | `400 Bad Request` / `404 Not Found` |
| **POST** | `/tasks` | Create a new task | `201 Created` | `400 Bad Request` / `415 Unsupported Media Type` |
| **PUT** | `/tasks/:id` | Update an existing task | `200 OK` | `400 Bad Request` / `404 Not Found` / `415 Unsupported Media` |
| **DELETE** | `/tasks/:id` | Remove a task | `200 OK` | `400 Bad Request` / `404 Not Found` |
| **GET** | `/simulate-error` | Deliberately triggers a 500 error for testing | `500 Server Error` (Error Caught) | `500 Internal Error` |

---

## 🏃 Launch and Run Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
- **Production Mode**:
  ```bash
  npm start
  ```
- **Development/Watch Mode** (Node.js 18+):
  ```bash
  npm run dev
  ```
The server will boot up on port `5000`: `http://localhost:5000`

---

## 🧪 Testing with cURL

Below are example queries to test the API routes:

- **Get all tasks**:
  ```bash
  curl -i http://localhost:5000/tasks
  ```
- **Create a task (201 Created)**:
  ```bash
  curl -i -X POST -H "Content-Type: application/json" -d "{\"title\":\"Review code\",\"description\":\"Check middleware pipeline\"}" http://localhost:5000/tasks
  ```
- **Simulate Invalid Content-Type (415 Unsupported Media Type)**:
  ```bash
  curl -i -X POST -d "{\"title\":\"test\"}" http://localhost:5000/tasks
  ```
- **Simulate Invalid Task ID Syntax (400 Bad Request)**:
  ```bash
  curl -i http://localhost:5000/tasks/abc
  ```
- **Simulate Missing Task (404 Not Found)**:
  ```bash
  curl -i http://localhost:5000/tasks/999
  ```
- **Simulate Uncaught Exception (500 Internal Server Error)**:
  ```bash
  curl -i http://localhost:5000/simulate-error
  ```

---

## 🌐 Practical 6: Full Stack Integration (React + Node + MongoDB)

### 🔌 CORS Middleware Configuration
To allow the React frontend running on `http://localhost:5173` to interact with this Express backend running on `http://localhost:5000`, the `cors` package is configured:
```javascript
const cors = require('cors');
app.use(cors());
```
This enables:
- Cross-Origin Resource Sharing for all HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`).
- Automatic preflight `OPTIONS` resolution.
- Secure communication between the Vite dev server and the Express API.

### 🔄 End-to-End Execution
1. Ensure your MongoDB Atlas connection string is configured in `.env`:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/taskmanager?retryWrites=true&w=majority
   PORT=5000
   ```
2. Start this backend server in terminal 1:
   ```bash
   npm run dev
   ```
3. Start the React frontend in terminal 2 (`portfolio-24DCE095/student-portfolio`):
   ```bash
   npm run dev
   ```
4. Access `http://localhost:5173/tasks` in your browser. All CRUD actions initiated from the React UI will persist directly to MongoDB via this API.

