require('dotenv').config();
const express = require('express');
const supabase = require('./supabase');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');

const app = express();

// ==========================================
// STAGE 4: AUTH MIDDLEWARE
// ==========================================
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return res.status(401).json({ error: 'Access token required' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.token = token;
  next();
}

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
app.post('/tasks', authMiddleware, async (req, res) => {
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
  app.put('/tasks/:id', authMiddleware, async (req, res) => {
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
app.delete('/tasks/:id', authMiddleware, async (req, res) => {
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

// ==========================================
// STAGE 1: AUTH ROUTES (SIGNUP & LOGIN)
// ==========================================

// POST /auth/signup - Create a new user account
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ user: data.user });
});

// POST /auth/login - Authenticate user & return JWT
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
});

// ==========================================
// STAGE 2: PUBLIC & PROTECTED GATES
// ==========================================

// GET /public/info - Public endpoint (no auth required)
app.get('/public/info', (req, res) => {
  return res.status(200).json({
    message: 'Welcome stranger! This info is public.'
  });
});
// GET /protected/profile - Protected by authMiddleware
app.get('/protected/profile', authMiddleware, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at
  });
});

// POST /auth/logout - End the user session
app.post('/auth/logout', authMiddleware, async (req, res) => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Logged out successfully' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port} and connected to Supabase`);
});