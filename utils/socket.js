import { Server } from 'socket.io';
import dotenv from 'dotenv';
import DuelManager from './duelManager.js';

dotenv.config();

const io = new Server(process.env.WEBSOCKET_PORT, { cors: { origin: "https://cpduels.onrender.com" } });

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

export default io;