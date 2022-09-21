import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import update_problemset from './utils/tasks.js';
import * as http from 'http';
import { Server } from 'socket.io'

// ENVIRONMENT VARIABLES
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

const httpServer = http.createServer(app);

const options = {
    cors: {
        origin: `http://localhost:${process.env.FRONTEND_PORT}`,
        methods: ["GET", "POST"]
    }
};
const io = new Server(httpServer, options);

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

db.on('error', (err) => console.log(err));
db.once('open', () => console.log("Connected to database."));

// update_problemset();

httpServer.listen(process.env.BACKEND_PORT, () => console.log("Server is started."));

const timeouts = [];

io.on('Start Timer', () => {
    let timeout = setTimeout(() => {
        io.emit('Duel Over');
    }, 5000);
    timeouts.push(timeout);
});
io.on('Stop Timer', () => {
    clearTimeout(timeouts[timeouts.length-1]);
    console.log("Timer stopped.");  
});

export default db;