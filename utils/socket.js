import { Server } from 'socket.io';
import dotenv from 'dotenv';
import DuelManager from './duelManager.js';

dotenv.config();

const io = new Server(process.env.WEBSOCKET_PORT, { cors: { origin: "http://localhost:3000" } });

async function getTimeLeft(startTime, maxTime, interval, roomId, io) {
    const curTime = new Date();
    let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
    if (timeDifference >= maxTime) {
      if (interval) clearInterval(interval);
      await DuelManager.changeDuelState(roomId, "FINISHED");
      io.emit('status-change', "FINISHED");
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
            const maxTime = timeLimit * 60000; // seconds to minutes, but in milliseconds
            await DuelManager.changeDuelState(roomId, "ONGOING");
            io.emit('status-change', "ONGOING");
            console.log('Yo here we go again');
            io.emit('time-left', timeLimit);
            let interval = setInterval(async () => {
                let timeLeft = await getTimeLeft(startTime, maxTime, interval, roomId, io);
                io.emit('time-left', timeLeft);
            }, 500);
        }
    });
});

export default io;