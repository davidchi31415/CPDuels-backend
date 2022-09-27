import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import DuelManager from './utils/duelManager.js';
import { Server } from 'socket.io';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "mongodb+srv://CPDuels:wrongfulphrasenimblemonumentshindigcardstockvastlyappraisalcloaktremor@cpduels.s78kdcw.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(DATABASE_URL);
const db = mongoose.connection;

let manager;
db.on('error', (err) => console.log(err));
db.once('open', async () => {
    console.log("Connected to database.");
    manager = new DuelManager();
    // await DuelManager.changeDuelState("632bbea40d58880cf56884c9", "ONGOING");
});

app.use(cors({ origin: ['https://cpduels.onrender.com', 'https://cpduels.com'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

const server = app.listen(PORT, () => console.log("Server is started."));
const io = new Server(server, {
    cors: {
        origin: ['https://cpduels.onrender.com', 'https://cpduels.com']
    }
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(__dirname + '/node_modules/socket.io/client-dist/socket.io.js');
});

async function getTimeLeft(startTime, maxTime, interval, roomId, io) {
    const curTime = new Date();
    let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
    if (timeDifference >= maxTime) {
      if (interval) clearInterval(interval);
      await DuelManager.changeDuelState(roomId, "FINISHED");
      io.emit('status-change', {roomId: roomId, newStatus: "FINISHED"});
      return "Time's up.";
    }
    return Math.ceil((maxTime - timeDifference)/1000);
}

io.on('connection', async (socket) => {
    socket.on('join', (roomId) => {
        socket.join(roomId);
    });
    socket.on('start-timer', async ({ roomId }) => {
        console.log('Timer Starting');
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === 'WAITING') {
            let duel = await DuelManager.findDuel(roomId);
            let timeLimit = duel.timeLimit;
            const startTime = new Date();
            const maxTime = timeLimit * 60000; // minutes to milliseconds
            await DuelManager.changeDuelState(roomId, "ONGOING");
            io.emit('status-change', {roomId: roomId, newStatus: "ONGOING"});
            console.log('Yo here we go again');
            io.emit('time-left', {roomId: roomId, timeLeft: timeLimit * 60});
            let interval = setInterval(async () => {
                let timeLeft = await getTimeLeft(startTime, maxTime, interval, roomId, io);
                io.emit('time-left', {roomId: roomId, timeLeft: timeLeft});
            }, 500);
        }
    });
});

export default db;