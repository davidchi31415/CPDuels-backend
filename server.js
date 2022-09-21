import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import update_problemset from './utils/tasks.js';
import { Server } from 'socket.io';

// ENVIRONMENT VARIABLES
import dotenv from 'dotenv';

dotenv.config();

const app = express();

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

db.on('error', (err) => console.log(err));
db.once('open', () => console.log("Connected to database."));

update_problemset();

app.use(cors({ origin: `http://localhost:${process.env.FRONTEND_PORT}` }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

app.listen(process.env.BACKEND_PORT, () => console.log("Server is started."));

const io = new Server(8081, { cors: { origin: "http://localhost:3000" } });
const timeouts = [];

io.on('connection', (socket) => {
    socket.on('Start Timer', () => {
        console.log('Yo here we go again');
        let timeout = setTimeout(() => {
            io.emit('Duel Over');
        }, 5000);
        timeouts.push(timeout);
    });
    socket.on('Stop Timer', () => {
        clearTimeout(timeouts[timeouts.length-1]);
        console.log("Timer stopped.");  
    });
});

export default db;