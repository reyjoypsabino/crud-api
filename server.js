const express = require ('express');
const app = express();
app.use(express.json());
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello, Server!');
});
app.get('/health', (req, res) => {
    re.json({status: "ok"});

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

app.post('/tasks', (req, res) => {
    const {title} = req.body;

    if (!title || title.trim() === ""){
        return res.status(400).json({ error: "Title is required"});
    }
    const newTask = {
        id: nextId++,
        title: title,
        done: false, 
    };
    tasks.push(newTask);
    res.status(201).json(newTak);
});

app.put('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find (t => t.id === taskId);

    if (!task) {
        return res.status(404).json({ error: `Task ${taskId} not found`});
    }
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "Request body cannot be empty"})
    }
    const { title, done } = req.body;

    if (title !==undefined) task.title = title;
    if (done !==undefined) task.done = done;
     
    res.json(task);

});
app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id == taskId);

    if (taskIndex == -1){
        return res.status(404).json({error: `Task ${taskId} not found`});
    }
    tasks.splice(taskIndex, 1);
    res.status(204).send();
});


app.listen(port, () =>{
    console.log(`Server running at http://localhost:${port}`);
});