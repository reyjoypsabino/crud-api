const express = require ('express');
const database = require ('better-sqlite3');
const swaggerUi = require ('swagger-ui-express');
const swaggerDocument = require ( './openapi.json');

const app = express();
app.use(express.json());
const port = 3000;

const db = new database('tasks.db');

db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done integer DEFAULT 0
    )`);

const countStmt = db.prepare('SELECT COUNT(*) AS count FROM tasks');
const { count } = countStmt.get();

if (count === 0) {
    const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    insert.run('Learn Express', 0);
    insert.run('Build CRUD API', 0);
    insert.run('Push to Github', 0);
    console.log('Inserted 3 initial tasks into tasks.db');
}

app.use ('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/', (req, res) => {
    res.send('Hello, Server!');
});
app.get('/health', (req, res) => {
    res.json({status: "ok"});

});

let tasks = [
    {id: 1, title: "Learn Express", done: false},
    {id: 2, title: "Build CRUD API", done: false},
    {id: 3, title: "Push to Github", done: false},
];
let nextId = 4;

app.get('/tasks', (req, res) => {
   const stmt = db.prepare('SELECT * FROM tasks');
   const tasks = stmt.all();

   const formattedTasks = tasks.map(t => ({
    ...t,
    done: Boolean(t.done)
}));

   res.json(formattedTasks);
});

app.get('/tasks/:id', (req, res) => {
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(req.params.id);

    if (!task){
        return res.status(404).json({error: 'Task not found'});
    }
    res.json({
    ...task,
    done: Boolean(task.done)
    });
});

app.post('/tasks', (req, res) => {
    const {title} = req.body;

    if (!title || title.trim() === ""){
        return res.status(400).json({ error: "Title is required"});
    }
   const stmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
   const info = stmt.run(title, 0);

   const getNewTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
   const newTask = getNewTask.get(info.lastInsertRowid);

    res.status(201).json({
        ...newTask,
        done: Boolean(newTask.done)
    });
});

app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    
    const checkStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const existingTask = checkStmt.get(taskId);

    if (!existingTask) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty" });
    }

    const { title, done } = req.body;
    const newTitle = title !== undefined ? title : existingTask.title;
    const newDone = done !== undefined ? (done ? 1 : 0) : existingTask.done;

    const updateStmt = db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?');
    updateStmt.run(newTitle, newDone, taskId);

    const updatedTask = checkStmt.get(taskId);
    res.json({
        ...updatedTask,
        done: Boolean(updatedTask.done)
    });

});
app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    
    const checkStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const existingTask = checkStmt.get(taskId);

    if (!existingTask) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    deleteStmt.run(taskId);

    res.status(204).send();
});


app.listen(port, () =>{
    console.log(`Server running at http://localhost:${port}`);
});