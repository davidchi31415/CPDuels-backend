import DuelManager from './DuelManager.js';

class SocketManager {
  constructor(io) {
    this.io = io;
    io.on("connection", async (socket) => {
      socket.on("join", (roomId) => {
        socket.join(roomId);
      });
      socket.on("join-duel", async ({ roomId, handle, uid }) => {
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === "WAITING") {
          console.log(handle + " Wants to Join Duel " + roomId);
          let validJoin = await DuelManager.isValidJoinRequest(
            roomId,
            handle
          );
          if (validJoin[0]) {
            await DuelManager.addDuelPlayer(roomId, handle, uid);
            await DuelManager.changeDuelState(roomId, "READY");
            io.emit("status-change", {
              roomId: roomId,
              newStatus: "READY",
            });
          } else {
            io.to(socket.id).emit("error-message", validJoin[1]);
          }
        }
      });
      socket.on("start-duel", async ({ roomId }) => {
        console.log("Timer Starting");
        let duelState = await DuelManager.getDuelState(roomId);
        if (duelState === "READY") {
          let duel = await DuelManager.findDuel(roomId);
          let timeLimit = duel.timeLimit;
          const startTime = new Date();
          const maxTime = timeLimit * 60000; // minutes to milliseconds
          await DuelManager.startDuel(roomId);
  
          console.log("Yo here we go again");
          io.emit("status-change", { roomId: roomId, newStatus: "ONGOING" });
          io.emit("problem-change", { roomId: roomId });
          io.emit("time-left", { roomId: roomId, timeLeft: timeLimit * 60 });
  
          let timeInterval;
          let checkInterval;
  
          checkInterval = setInterval(async () => {
            await DuelManager.checkProblemSolves(roomId);
            let duel = await DuelManager.findDuel(roomId);
            if (
              duel.playerOneSolves === duel.problems.length ||
              duel.playerTwoSolves === duel.problems.length
            ) {
              if (timeInterval) clearInterval(timeInterval);
              if (checkInterval) clearInterval(checkInterval);
              await DuelManager.finishDuel(roomId);
              io.emit("status-change", {
                roomId: roomId,
                newStatus: "FINISHED",
              });
            }
          }, 3000);
          timeInterval = setInterval(async () => {
            let timeLeft = await getTimeLeft(
              startTime,
              maxTime,
              timeInterval,
              checkInterval,
              roomId,
              io
            );
            io.emit("time-left", { roomId: roomId, timeLeft: timeLeft });
          }, 1000);
        }
      });
      socket.on("submit-problem", async ({ roomId, uid, submission }) => {
        console.log(
          `Duel ${roomId}, player with uid ${uid} is submitting a problem.`
        );
        try {
          let duel = await DuelManager.findDuel(roomId);
          let valid = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) valid = true;
          }
          if (valid) {
            await DuelManager.submitProblem(roomId, uid, submission);
            io.emit("problem-submitted-success", {
              roomId: roomId,
              uid: uid,
            });
          } else {
            console.log(`Not a valid uid for submission to Duel ${roomId}`);
            io.emit("problem-submitted-error", {
              roomId: roomId,
              uid: uid,
              message: "You are not recognized as a duel participant",
            });
          }
        } catch (e) {
          console.log(`Error submitting problem in Duel ${roomId}: ${e}`);
        }
      });
    });
  }

  async getTimeLeft(
  	startTime,
  	maxTime,
  	timeInterval,
  	checkInterval,
  	roomId,
  ) {
  	const curTime = new Date();
  	let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
  	if (timeDifference >= maxTime) {
  		if (timeInterval) clearInterval(timeInterval);
  		if (checkInterval) clearInterval(checkInterval);
  		await DuelManager.finishDuel(roomId);
  		this.io.emit("status-change", { roomId: roomId, newStatus: "FINISHED" });
  		return "Time's up.";
  	}
  	return Math.ceil((maxTime - timeDifference) / 1000);
  }
}

export default SocketManager;