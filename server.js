import express, { response } from 'express';
import mongoose from 'mongoose';
import duelsRouter from './routes/duelsRouter.js';
import cfproblemsRouter from './routes/cfproblemsRouter.js';
import DuelManager from './utils/duelManager.js';
import { Server } from 'socket.io';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import allowedOrigins from './config/origins.js';
import TaskManager from './utils/taskManager.js';
import { sleep } from './utils/helpers.js';
import cors from 'cors';
import CodeforcesAPI from './utils/codeforcesAPI.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL || "mongodb+srv://CPDuels:wrongfulphrasenimblemonumentshindigcardstockvastlyappraisalcloaktremor@cpduels.s78kdcw.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(DATABASE_URL);
const db = mongoose.connection;
db.on('error', (err) => console.log(err));
db.once('open', async () => console.log("Connected to database."));
while(mongoose.connection.readyState != 1) {
    await sleep(1000);
}

app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duels', duelsRouter);
app.use('/cfproblems', cfproblemsRouter);

const server = app.listen(PORT, () => console.log(`Server is started on port ${PORT}.`));
const io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

async function getTimeLeft(startTime, maxTime, timeInterval, checkInterval, roomId, io) {
    const curTime = new Date();
    let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
    if (timeDifference >= maxTime) {
      if (timeInterval) clearInterval(timeInterval);
      if (checkInterval) clearInterval(checkInterval);
      await DuelManager.finishDuel(roomId);
      io.emit('status-change', {roomId: roomId, newStatus: "FINISHED"});
      return "Time's up.";
    }
    return Math.ceil((maxTime - timeDifference)/1000);
}

io.on('connection', async (socket) => {

    socket.on('join', (roomId) => {
        socket.join(roomId);
    });
    socket.on('join-duel', async ({ roomId, handle, uid }) => {
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === 'WAITING') {
            console.log(handle + " Wants to Join Duel " + roomId);
            let validJoin = await DuelManager.isValidJoinRequest(roomId, handle);
            if (validJoin[0]) {
                await DuelManager.addDuelPlayer(roomId, handle, uid);
                await DuelManager.changeDuelState(roomId, "READY");
                io.emit('status-change', {roomId: roomId, newStatus: "READY"});
            } else {
                io.to(socket.id).emit('error-message', validJoin[1]);
            }
        }
    })
    socket.on('start-duel', async ({ roomId }) => {
        console.log('Timer Starting');
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === 'READY') {
            let duel = await DuelManager.findDuel(roomId);
            let timeLimit = duel.timeLimit;
            const startTime = new Date();
            const maxTime = timeLimit * 60000; // minutes to milliseconds
            await DuelManager.startDuel(roomId);

            console.log('Yo here we go again');
            io.emit('status-change', {roomId: roomId, newStatus: "ONGOING"});
            io.emit('problem-change', {roomId: roomId});
            io.emit('time-left', {roomId: roomId, timeLeft: timeLimit * 60});
            
            let timeInterval; let checkInterval;

            checkInterval = setInterval(async () => {
                await DuelManager.checkProblemSolves(roomId);
                let duel = await DuelManager.findDuel(roomId);
                if (duel.playerOneSolves === duel.problems.length || duel.playerTwoSolves === duel.problems.length) {
                    if (timeInterval) clearInterval(timeInterval);
                    if (checkInterval) clearInterval(checkInterval);
                    await DuelManager.finishDuel(roomId);
                    io.emit('status-change', {roomId: roomId, newStatus: "FINISHED"});
                }
            }, 3000);
            timeInterval = setInterval(async () => {
                let timeLeft = await getTimeLeft(startTime, maxTime, timeInterval, checkInterval, roomId, io);
                io.emit('time-left', {roomId: roomId, timeLeft: timeLeft});
            }, 1000);
        }
    });
});

export default db;