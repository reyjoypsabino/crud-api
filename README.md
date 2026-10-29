Here is your updated `README.md` that keeps your exact style, structure, sample curl, and Swagger screenshot reference from Assignment 1 (`BE-01`) while seamlessly adding all required Stage 5 details for Assignment 2 (`BE-02`):

```markdown
# Task Management CRUD API

A lightweight server-side REST API built with Node.js and Express that manages a to-do list backed by a persistent **SQLite** database[cite: 1, 2]. 

This project was built as part of the FlyRank Backend AI Engineering internship assignment (`BE-01` & `BE-02`)[cite: 1, 2].

---

## 🗄️ Database Choice & Architecture (Assignment 2)

- **Why SQLite?** SQLite was chosen because it is lightweight, zero-configuration, and runs embedded directly within Node.js via `better-sqlite3`[cite: 1, 2]. It requires no separate database server installation or setup, while guaranteeing that all task data persists across server restarts[cite: 1, 2].
- **Database Location:** Stored as `tasks.db` in the project root directory[cite: 1, 2].
- **Automatic Setup & Seeding:** On application startup, the server automatically creates the `tasks` table if it does not exist[cite: 1, 2]. If the database is empty (`COUNT(*) === 0`), it automatically seeds three initial tasks (`Learn Express`, `Build CRUD API`, `Push to Github`) so anyone cloning the repository gets a working app immediately[cite: 1, 2].

---

## 🚀 Features & Endpoints

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | API Metadata | `200 OK` |
| `GET` | `/health` | Server Health Check | `200 OK` |
| `GET` | `/tasks` | List all tasks from SQLite | `200 OK` |
| `GET` | `/tasks/:id` | Get single task by ID | `200 OK` / `404 Not Found` |
| `POST` | `/tasks` | Create a new task in SQLite | `201 Created` / `400 Bad Request` |
| `PUT` | `/tasks/:id` | Update task title/status | `200 OK` / `400 Bad Request` / `404 Not Found` |
| `DELETE` | `/tasks/:id` | Remove a task by ID | `204 No Content` / `404 Not Found` |
| `GET` | `/docs` | Interactive Swagger UI | `200 OK` |

---

## 🛠️ How to Install and Run

### Prerequisites
- Node.js installed on your machine.

### Setup
1. Clone the repository:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd crud-api

```

2. Install dependencies:
```bash
npm install

```


3. Start the server:
```bash
node server.js

```


4. Access the API at `http://localhost:3000` or open Swagger UI at `http://localhost:3000/docs`.

---

## 🔍 SQL Exploration (Stage 4)

During manual database testing, SQL queries were executed directly against `tasks.db`:

```sql
SELECT * FROM tasks WHERE done = 1;

```

Returned all task records from the `tasks` table where the completion status column `done` equaled `1` (`true`).

---

## 🧪 Sample Request & Response (`curl`)

```bash
$ curl.exe -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d '{\"done\":true}'

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 44
Date: Wed, 28 Oct 2026 08:23:25 GMT

{"id":1,"title":"Learn Express","done":true}

```

---

## 📖 Swagger UI & Database Documentation

Interactive Swagger documentation is available at `http://localhost:3000/docs`.

```

---

### Push Stage 5 to GitHub

After replacing the contents of your `README.md` file and saving (`Ctrl + S`), run these final commands in **Terminal 2** to complete Assignment 2[cite: 1, 2]:

```powershell
git add .
git commit -m "Stage 5: database documentation"
git push

```