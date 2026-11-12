# Task Management CRUD API

A lightweight server-side REST API built with Node.js and Express that manages a to-do list backed by a persistent PostgreSQL database, secured with **Supabase Auth (JWT)**, and containerized with Docker Compose.

This project evolved across FlyRank Backend AI Engineering internship assignments (`BE-01`, `BE-02`, `BE-04`, and `BE-03`):
- **BE-01**: Express REST API with in-memory storage and Swagger UI documentation.
- **BE-02**: Integrated embedded **SQLite** database (`tasks.db`) using `better-sqlite3`.
- **BE-04**: Containerized the entire stack with **Docker Compose**, migrating storage to a **PostgreSQL 16** database container with volume persistence.
- **BE-03**: Integrated **Supabase Auth** (`@supabase/supabase-js`) for user registration, login/logout, JWT verification, `authMiddleware` route protection, and Swagger Bearer authentication.

---

## 🔐 Authentication & Route Protection (BE-03)

- **Identity Provider:** Delegates user credential storage, password hashing, and JWT signing to **Supabase Auth** instead of custom cryptography.
- **Token Verification:** Protected endpoints require an `Authorization: Bearer <access_token>` header, validated server-side via `supabase.auth.getUser(token)`.
- **Reusable Middleware Guard (`authMiddleware`):** Centralizes token extraction and verification, attaching `req.user` to authenticated requests and returning `401 Unauthorized` when tokens are missing, malformed, or invalid.
- **Access Control Policy:** Public read endpoints (`GET /tasks`, `GET /tasks/:id`, `GET /public/info`) remain open, while state-changing task operations (`POST`, `PUT`, `DELETE`) and private user endpoints (`GET /protected/profile`, `POST /auth/logout`) require a valid JWT.

---

## 🗄️ Database Architecture & Migration

### 1. SQLite Integration (Assignment 2)
- **Why SQLite originally?** SQLite was chosen because it is lightweight, zero-configuration, and runs embedded directly within Node.js via `better-sqlite3`. It required no separate database server installation while guaranteeing task data persisted across server restarts.
- **Database Location:** Stored as `tasks.db` in the project root directory.

### 2. PostgreSQL & Docker Containerization (Assignment 3 / BE-04)
- **Why PostgreSQL?** Upgraded to a production-grade, standalone database engine running inside a Docker container (`postgres:16`).
- **Secrets Management:** Environment variables are loaded via `.env` (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `PORT`). `.env` is git-ignored for security, while a template `.env.example` is committed.
- **Data Persistence:** Data is mounted to a named Docker Volume (`taskdata`) so all database records outlive container restarts.
- **Architecture Layering Integrity:** Swapping from SQLite to PostgreSQL only required updating the database pool initialization and query layer (`pg`). All API routes, validation logic, status codes, and Swagger UI documentation remained cleanly separated.

---

## 🚀 Features & Endpoints

| Method | Endpoint | Auth | Description | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | API Metadata | `200 OK` |
| `GET` | `/health` | Public | Server Health Check | `200 OK` |
| `POST` | `/auth/signup` | Public | Register a new user via Supabase Auth | `201 Created` / `400 Bad Request` |
| `POST` | `/auth/login` | Public | Authenticate user and return JWT tokens | `200 OK` / `400 Bad Request` / `401 Unauthorized` |
| `POST` | `/auth/logout` | Bearer JWT | Terminate active user session | `200 OK` / `401 Unauthorized` |
| `GET` | `/public/info` | Public | Open public endpoint | `200 OK` |
| `GET` | `/protected/profile` | Bearer JWT | Return verified user metadata (`id`, `email`, `created_at`) | `200 OK` / `401 Unauthorized` |
| `GET` | `/tasks` | Public | List all tasks from PostgreSQL | `200 OK` |
| `GET` | `/tasks/:id` | Public | Get single task by ID | `200 OK` / `404 Not Found` |
| `POST` | `/tasks` | Bearer JWT | Create a new task | `201 Created` / `400 Bad Request` / `401 Unauthorized` |
| `PUT` | `/tasks/:id` | Bearer JWT | Update task title/status | `200 OK` / `400 Bad Request` / `401 Unauthorized` / `404 Not Found` |
| `DELETE` | `/tasks/:id` | Bearer JWT | Remove a task by ID | `204 No Content` / `401 Unauthorized` / `404 Not Found` |
| `GET` | `/docs` | Public | Interactive Swagger UI with Bearer Auth | `200 OK` |

---

## 🛠️ How to Install and Run

### 1. Configure Environment Variables
Clone the repository and create your local `.env` file:

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd crud-api
cp .env.example .env
```

Populate `.env` with your PostgreSQL and Supabase project credentials:

```env
PORT=3000
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### Option A: Docker Compose (Recommended - BE-04)

Start the API and PostgreSQL database together with a single command:

```bash
docker compose up --build
```

Access the API at `http://localhost:3000` or open Swagger UI at `http://localhost:3000/docs`.

### Option B: Local Node.js Development

Start PostgreSQL container independently:

```powershell
docker run --name taskdb -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=tasks -p 5432:5432 -v taskdata:/var/lib/postgresql/data -d postgres:16
```

Install dependencies & run server:

```powershell
npm install
node server.js
```

---

## 🔍 SQL Exploration & Direct Querying

### SQLite Testing (Assignment 2)
Executed directly against `tasks.db`:

```sql
SELECT * FROM tasks WHERE done = 1;
```

### PostgreSQL Testing (Assignment 3 / BE-04)
Executed directly inside the PostgreSQL container using `psql`:

```powershell
docker exec -it crud-api-db-1 psql -U postgres -d tasks -c "SELECT * FROM tasks;"
```

Terminal Output:

```plaintext
 id |       title        | done 
----+--------------------+------
  1 | Learn Express      | f
  2 | Build CRUD API     | f
  3 | Push to Github     | f
  4 | Docker Volume Test | f
(4 rows)
```

---

## 💾 Volume Persistence Proof (BE-04)

Data persistence across full stack restarts was verified with the following steps:

1. Created a new task:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/tasks" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body '{"title":"Docker Volume Test"}'
   ```
2. Tore down the container stack:
   ```powershell
   docker compose down
   ```
3. Restarted the stack:
   ```powershell
   docker compose up -d
   ```
4. Verified data survival:
   `GET /tasks` returned all 4 tasks (including `Docker Volume Test`), confirming that the named volume `taskdata` safely retained all database state across container destruction.

---

## 🧪 Sample Requests & Responses

### Authenticate & Call Protected Endpoints (PowerShell / curl)

```powershell
# 1. Log in to receive a JWT access token
$res = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"testuser2026@gmail.com","password":"password123"}'
$token = $res.access_token

# 2. Access protected user profile
curl.exe -i http://localhost:3000/protected/profile -H "Authorization: Bearer $token"

# 3. Update a protected task
curl.exe -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "{\"done\":true}"
```

Sample Response:

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 44

{"id":1,"title":"Learn Express","done":true}
```

---

## 📖 Swagger UI & Database Documentation

Interactive Swagger documentation is available at `http://localhost:3000/docs`. Use `POST /auth/login` to obtain an `access_token`, click **Authorize** at the top right, and paste the token to test protected routes directly in the browser.

![Swagger UI Screenshot](./swagger-screenshot.png)

### Database Terminal Verification
![PostgreSQL Database Screenshot](./db-screenshot.png)