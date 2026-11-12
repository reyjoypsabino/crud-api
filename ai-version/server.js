require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize Supabase & PostgreSQL clients from environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Load OpenAPI specification for Swagger UI
const openApiPath = path.join(__dirname, 'openapi.json');
const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Reusable JWT Authentication Middleware
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Initialize tasks table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    done BOOLEAN DEFAULT false
  )
`).catch((err) => console.error('Database init error:', err.message));

// Root API metadata
app.get('/', (req, res) => {
  return res.status(200).json({
    name: 'AI Tasks & Auth API',
    status: 'running',
    docs: '/docs'
  });
});

// Health check
app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok' });
});

// ==========================================
// AUTH ROUTES
// ==========================================

app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ user: data.user });
  } catch (err) {
    return res.status(400).json({ error: 'Unable to register user' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data?.session) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }
});

app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(400).json({ error: 'Logout failed' });
  }
});

// ==========================================
// PUBLIC & PROTECTED ACCESS GATES
// ==========================================

app.get('/public/info', (req, res) => {
  return res.status(200).json({
    message: 'Welcome stranger! This info is public.'
  });
});

app.get('/protected/profile', authenticateToken, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at
  });
});

// ==========================================
// TASK CRUD ROUTES
// ==========================================

app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, done FROM tasks ORDER BY id ASC'
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

app.get('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const result = await pool.query(
      'SELECT id, title, done FROM tasks WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve task' });
  }
});

app.post('/tasks', authenticateToken, async (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING id, title, done',
      [title.trim(), false]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const { title, done } = req.body || {};
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const result = await pool.query(
      'UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING id, title, done',
      [title !== undefined ? String(title).trim() : null, done !== undefined ? Boolean(done) : null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.listen(port, () => {
  console.log(`AI server running on http://localhost:${port}`);
});