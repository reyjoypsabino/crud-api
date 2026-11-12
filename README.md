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

---

## 🤖 AI vs me (Stage 7 — The AI Rematch)

### My 4D Prompt Used to Generate `ai-version/`

```text
### 1. DELEGATION (Role & Boundaries)
Act as a backend Node.js developer. Your task is to generate a complete, runnable Express REST API (`server.js`) and OpenAPI specification (`openapi.json`) implementing authentication and route protection. Do not generate `.env` files, database migrations, or Supabase dashboard configurations—I will manage environment secrets, Supabase setup, and security code review myself.

### 2. DESCRIPTION (Technical Specifications)
Build the backend in the **JavaScript lane (Node.js + Express)** using **Supabase Auth (`@supabase/supabase-js`)** as the Identity Provider and **PostgreSQL (`pg`)** for task persistence.

Implement the following endpoints and exact HTTP status codes:
- `POST /auth/signup` (Public): Accepts `{ email, password }`, validates missing fields (`400`), registers the user via `supabase.auth.signUp()`, and returns the created user (`201`).
- `POST /auth/login` (Public): Accepts `{ email, password }`, validates missing fields (`400`), signs in via `supabase.auth.signInWithPassword()`, returns `401` on invalid credentials, and returns `{ access_token, refresh_token }` on success (`200`).
- `POST /auth/logout` (Protected): Requires a valid Bearer JWT, ends the session via `supabase.auth.signOut()`, and returns confirmation (`200`) or `401` if unauthorized.
- `GET /public/info` (Public): Returns a public welcome JSON message (`200`).
- `GET /protected/profile` (Protected): Requires a valid Bearer JWT and returns the verified user's `id`, `email`, and `created_at` (`200`), or `401` if missing/invalid.
- Task Routes (`/tasks` and `/tasks/:id`): Keep `GET /tasks` (`200`) and `GET /tasks/:id` (`200`/`404`) public. Protect `POST /tasks` (`201`/`400`/`401`), `PUT /tasks/:id` (`200`/`400`/`401`/`404`), and `DELETE /tasks/:id` (`204`/`401`/`404`) with JWT authentication.

Middleware & Documentation Requirements:
- Create a reusable Express middleware function that extracts the `Authorization: Bearer <token>` header and verifies the token against Supabase (`supabase.auth.getUser(token)`).
- Configure Swagger UI at `/docs` with an OpenAPI `bearerAuth` HTTP security scheme so protected routes can be tested with a JWT.

### 3. DISCERNMENT (Quality & Verification Criteria)
Ensure the code satisfies these verification checks before finalizing:
- Reject requests missing the `Authorization` header, lacking the `"Bearer "` prefix, or containing an empty/tampered token with `401 Unauthorized`.
- Explicitly check both `error` and `!data?.user` from `supabase.auth.getUser(token)` rather than assuming a truthy response means valid authentication.
- Keep async database and auth calls wrapped cleanly so invalid inputs return `400` or `401` instead of crashing the Express server.

### 4. DILIGENCE (Security & Responsibility Guardrails)
- Load `PORT`, `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_KEY` strictly from `process.env` (`dotenv`). Never hardcode secrets or reference a `service_role` key.
- Never log raw passwords, `access_token` strings, or authorization headers to the console.
```

### Code Review Findings (`git diff --no-index server.js ai-version/server.js`)

1. **How did it handle token extraction?**
   - Both implementations enforce `authHeader.startsWith('Bearer ')` so a raw `Authorization: <token>` header without the `"Bearer "` prefix is rejected with `401 Unauthorized` instead of slipping through or crashing. My version extracted the token with `authHeader.split(' ')[1]`, whereas the AI used `authHeader.slice(7).trim()` to slice off the exact 7-character `"Bearer "` prefix cleanly.
2. **What security flaws might it have introduced?**
   - None introduced in the auth flow: the AI explicitly verified both `error` and `!data?.user` from `supabase.auth.getUser(token)`, wrapped token verification in a `try / catch` block, loaded keys strictly from `.env` without referencing `service_role`, and never logged passwords or JWTs.
3. **What did my prompt forget to specify—and what did the AI silently decide?**
   - **Startup database initialization & root metadata:** My prompt did not mention `GET /` or creating the `tasks` table on boot, so the AI omitted `GET /` and assumed `tasks` already existed in PostgreSQL.
   - **Module structure & config loading:** My `server.js` isolates Supabase in `supabase.js` (`require('./supabase')`) and imports `openapi.json` directly, whereas the AI initialized `createClient()` inline in `server.js` and read `openapi.json` via `fs.readFileSync`.
   - **Parameter validation & middleware naming:** The AI silently added `Number.isInteger(Number(req.params.id))` validation (`400 Invalid task ID`), `typeof title !== 'string'` checks, a `!data?.session` guard on `/auth/login`, and named the guard `authenticateToken` instead of `authMiddleware`.

### One Rematch (Prompt Iteration & Result)
- **What changed in the rematch:** After updating the prompt to explicitly require `GET /` API metadata, automatic `CREATE TABLE IF NOT EXISTS tasks` initialization on startup, and integer `:id` validation, the regenerated `ai-version/server.js` now self-initializes its PostgreSQL schema and matches all routes in my hand-built API.