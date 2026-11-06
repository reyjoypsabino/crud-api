require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

// Initialize PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Auto-create table and seed initial tasks if empty
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN DEFAULT false
      );
    `);

    const countRes = await pool.query('SELECT COUNT(*) AS count FROM tasks;');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO tasks (title, done) VALUES
        ('Learn Express', false),
        ('Build CRUD API', false),
        ('Push to Github', false);
      `);
      console.log('Inserted 3 initial tasks into Postgres');
    }
    console.log('PostgreSQL initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDb();

// Swagger UI Documentation Route
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Base Endpoints
app.get('/', (req, res) => {
  res.send('Hello, Server!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks - List all tasks
app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id ASC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /tasks/:id - Get single task
app.get('/tasks/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1;', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /tasks - Create a new task
app.post('/tasks', async (req, res) => {
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *;',
      [title.trim(), false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /tasks/:id - Update existing task
app.put('/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  try {
    const checkStmt = await pool.query('SELECT * FROM tasks WHERE id = $1;', [taskId]);
    if (checkStmt.rows.length === 0) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body cannot be empty' });
    }

    const existingTask = checkStmt.rows[0];
    const { title, done } = req.body;
    const newTitle = title !== undefined ? title : existingTask.title;
    const newDone = done !== undefined ? Boolean(done) : existingTask.done;

    const updateResult = await pool.query(
      'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *;',
      [newTitle, newDone, taskId]
    );

    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /tasks/:id - Remove task
app.delete('/tasks/:id', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  try {
    const checkStmt = await pool.query('SELECT * FROM tasks WHERE id = $1;', [taskId]);
    if (checkStmt.rows.length === 0) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1;', [taskId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});