import { Server } from 'socket.io';
import dotenv from 'dotenv';
import DuelManager from './duelManager.js';

dotenv.config();

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

io.on('connection', async (socket) => {
    socket.on('join', (roomId) => {
        socket.join(roomId);
    });
    socket.once('startTimer', async ({ roomId, timeLimit }) => {
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === 'WAITING') {
            await DuelManager.changeDuelState(roomId, "ONGOING");
            console.log('Yo here we go again');
            console.log(roomId);
            const startTime = new Date();
            const maxTime = timeLimit*1000; // 60 seconds
            socket.to(roomId).emit('timeLeft', getTimeLeft(startTime, maxTime));
            let interval = setInterval(() => {
                socket.to(roomId).emit('timeLeft', getTimeLeft(startTime, maxTime, interval));
            }, 500);
        }
    });
});

export default io;