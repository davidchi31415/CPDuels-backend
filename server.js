import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import update_problemset from './utils/tasks.js';
import { Server } from 'socket.io';

// ENVIRONMENT VARIABLES
import dotenv from 'dotenv';
import find_problems from './utils/codeforces.js';

dotenv.config();

const app = express();

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

db.on('error', (err) => console.log(err));
db.once('open', async () => {
    console.log("Connected to database.");
    let problems = await find_problems({ rating: { $gt: 1799}});
    console.log(problems);
});

app.use(cors({ origin: `http://localhost:3000` }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

app.listen(process.env.BACKEND_PORT, () => console.log("Server is started."));

const io = new Server(process.env.WEBSOCKET_PORT, { cors: { origin: "http://localhost:3000" } });

function getTimeLeft(startTime, maxTime, interval=null) {
  const curTime = new Date();

  let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());

  if (timeDifference >= maxTime) {
    if (interval) clearInterval(interval);
    return "Time's up.";
  }
  return Math.ceil((maxTime - timeDifference)/1000);
}

io.on('connection', (socket) => {
    socket.on('startTimer', (timeLimit) => {
        console.log('Yo here we go again');
        const startTime = new Date();
        const maxTime = timeLimit*1000; // 60 seconds
        socket.emit('timeLeft', getTimeLeft(startTime, maxTime));
        let interval = setInterval(() => {
            socket.emit('timeLeft', getTimeLeft(startTime, maxTime, interval));
        }, 500);
    });
});

export default db;