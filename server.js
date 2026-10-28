const express = require ('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello, Server!');
});

let tasks = [
    {id: 1, title: "Learn Express", done: false},
    {id: 2, title: "Build CRUD API", done: false},
    {id: 3, title: "Push to Github", done: false},
];
let nextId = 4;

app.get('/tasks', (req, res) => {
    res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
    const task =tasks.find(t => t.id === parseInt(req.params.id));
    if(!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found`});
    }
    res.json(task);
});

app.listen(port, () =>{
    console.log(`Server running at http://localhost:${port}`);
});