import express from 'express';
import mongoose from 'mongoose';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import DuelManager from './utils/duelManager.js';
import { Server } from 'socket.io';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import allowedOrigins from './config/origins.js';
import TaskManager from './utils/taskManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL || "mongodb+srv://CPDuels:wrongfulphrasenimblemonumentshindigcardstockvastlyappraisalcloaktremor@cpduels.s78kdcw.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(DATABASE_URL);
const db = mongoose.connection;
db.on('error', (err) => console.log(err));
db.once('open', async () => console.log("Connected to database."));
while(mongoose.connection.readyState != 1) {
    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    await sleep(1000);
}
app.use(function (req, res, next) {
    const allowedDomains = allowedOrigins;
    const origin = req.headers.origin;
    if(allowedDomains.indexOf(origin) > -1){
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', true);
  
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duels', duelsRouter);
app.use('/problems', problemsRouter);

const server = app.listen(PORT, () => console.log("Server is started."));
const io = new Server(server, {
    cors: {
        origin: allowedOrigins
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
            await DuelManager.changeDuelState(roomId, "ONGOING");
            io.emit('status-change', {roomId: roomId, newStatus: "ONGOING"});
            console.log('Yo here we go again');

            await DuelManager.addProblems(roomId);
            io.emit('problem-change', {roomId: roomId});
            io.emit('time-left', {roomId: roomId, timeLeft: timeLimit * 60});
            let timeInterval = setInterval(async () => {
                let timeLeft = await getTimeLeft(startTime, maxTime, timeInterval, roomId, io);
                io.emit('time-left', {roomId: roomId, timeLeft: timeLeft});
            }, 1000);
            let checkInterval = setInterval(async () => {
                
            }, 3000);
        }
    });
});

export default db;