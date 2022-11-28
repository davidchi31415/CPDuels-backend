import DuelManager from "./DuelManager.js";
import TaskManager from "./TaskManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";

class SocketManager {
  constructor(io) {
    this.codeforcesAPI = new CodeforcesAPI();
    const taskManager = new TaskManager(this.codeforcesAPI);
    const duelManager = new DuelManager(this.codeforcesAPI, taskManager);
    // taskManager.init();
    setInterval(async () => {
      let checkedCF = await this.codeforcesAPI.updateSubmissions(); // set
      if (checkedCF) {
        for (const item of checkedCF) {
          io.emit("submission-change", { uid: item });
        }
      }
    }, 10000);
    this.io = io;
    io.on("connection", async (socket) => {
      socket.on("join", (roomId) => {
        socket.join(roomId);
      });
      socket.on("join-duel", async ({ roomId, username, guest, uid }) => {
        let duelState = await duelManager.getDuelState(roomId);
        if (duelState === "WAITING") {
          console.log(username + " Wants to Join Duel " + roomId);
          let validJoin = await duelManager.isValidJoinRequest(
            roomId,
            username,
            guest
          );
          if (validJoin[0]) {
            await duelManager.addDuelPlayer(roomId, username, guest, uid);
            await duelManager.changeDuelState(roomId, "READY");
            io.emit("status-change", {
              roomId: roomId,
              newStatus: "READY",
            });
          } else {
            io.to(socket.id).emit("join-duel-error", { message: validJoin[1] });
          }
        }
      });
      socket.on("start-duel", async ({ roomId }) => {
        console.log("Timer Starting");
        let duelState = await duelManager.getDuelState(roomId);
        if (duelState === "READY") {
          let duel = await duelManager.getDuel(roomId);
          let timeLimit = duel.timeLimit;
          const startTime = new Date();
          const maxTime = timeLimit * 60000; // minutes to milliseconds
          await duelManager.startDuel(roomId);

          console.log("Yo here we go again");
          io.emit("status-change", {
            roomId: roomId,
            newStatus: "ONGOING",
          });
          io.emit("problem-change", { roomId: roomId });
          io.emit("time-left", {
            roomId: roomId,
            timeLeft: timeLimit * 60,
          });

          this.checkInterval = setInterval(async () => {
            // await duelManager.checkProblemSolves(roomId);
            let duel = await duelManager.getDuel(roomId);
            if (
              duel.playerOneSolves === duel.problems.length ||
              duel.playerTwoSolves === duel.problems.length
            ) {
              if (this.timeInterval) clearInterval(this.timeInterval);
              if (this.checkInterval) clearInterval(this.checkInterval);
              await duelManager.finishDuel(roomId);
              io.emit("status-change", {
                roomId: roomId,
                newStatus: "FINISHED",
              });
            }
          }, 3000);
          this.timeInterval = setInterval(async () => {
            let timeLeft = await this.getTimeLeft(
              startTime,
              maxTime,
              this.timeInterval,
              this.checkInterval,
              roomId,
              io,
              duelManager
            );
            io.emit("time-left", {
              roomId: roomId,
              timeLeft: timeLeft,
            });
          }, 1000);
        }
      });
      socket.on("submit-problem", async ({ roomId, uid, submission }) => {
        console.log(
          `Duel ${roomId}, player with uid ${uid} is submitting a problem.`
        );
        try {
          console.log(roomId);
          let duel = await duelManager.getDuel(roomId);
          let valid = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) valid = true;
          }
          if (valid) {
            let submitted = await duelManager.submitProblem(
              roomId,
              uid,
              submission
            );
            if (submitted[0])
              io.emit("problem-submitted-success", {
                roomId: roomId,
                uid: uid,
              });
            else
              io.emit("problem-submitted-success", {
                roomId: roomId,
                uid: uid,
                message: "Could not submit. Please retry."
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
      socket.on("abort-duel", async ({ roomId, uid }) => {
        console.log(`Duel ${roomId}, player with uid ${uid} is aborting duel.`);

        try {
          let duel = await duelManager.getDuel(roomId);
          let valid = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) valid = true;
          }
          if (valid) {
            await duelManager.abortDuel(roomId);
            if (this.checkInterval) clearInterval(this.checkInterval);
            if (this.timeInterval) clearInterval(this.timeInterval);
            io.emit("status-change", { roomId: roomId, newStatus: "ABORTED" });
          } else {
            console.log(`Not a valid uid for aborting Duel ${roomId}`);
            io.emit("abort-duel-error", {
              roomId: roomId,
              uid: uid,
              message: "You are not recognized as a duel participant",
            });
          }
        } catch (e) {
          console.log(`Error aborting duel in Duel ${roomId}: ${e}`);
        }
      });
      socket.on("resign-duel", async ({ roomId, uid }) => {
        console.log(
          `Duel ${roomId}, player with uid ${uid} is resigning duel.`
        );

        try {
          let duel = await duelManager.getDuel(roomId);
          let valid = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) valid = true;
          }
          if (valid) {
            await duelManager.resignDuel(roomId, uid);
            if (this.checkInterval) clearInterval(this.checkInterval);
            if (this.timeInterval) clearInterval(this.timeInterval);
            io.emit("status-change", { roomId: roomId, newStatus: "FINISHED" });
          } else {
            console.log(`Not a valid uid for resigning Duel ${roomId}`);
            io.emit("resign-duel-error", {
              roomId: roomId,
              uid: uid,
              message: "You are not recognized as a duel participant",
            });
          }
        } catch (e) {
          console.log(`Error resigning duel in Duel ${roomId}: ${e}`);
        }
      });
      socket.on("message-send", async ({ roomId, uid, message }) => {
        try {
          let valid = false;
          let duel = await duelManager.getDuel(roomId);
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) {
              valid = true;
              break;
            }
          }
          if (valid)
            io.emit("message-receive", {
              roomId: roomId,
              senderUid: uid,
              message: message,
            });
          else
            io.emit("message-send-error", {
              roomId: roomId,
              senderUid: uid,
              message: "You are not recognized as a duel participant",
            });
        } catch (e) {
          console.log(`Error sending message in Duel ${roomId}: ${e}`);
        }
      });
      socket.on("message-typing-send", async ({ roomId, uid, author }) => {
        try {
          io.emit("message-typing-receive", {
            roomId: roomId,
            senderUid: uid,
            author: author,
          });
        } catch (e) {
          console.log(`Error typing a message in Duel ${roomId}: ${e}`);
        }
      });
    });
  }

  async init() {
    await this.codeforcesAPI.init();
  }

  async getTimeLeft(
    startTime,
    maxTime,
    timeInterval,
    checkInterval,
    roomId,
    io,
    duelManager
  ) {
    const curTime = new Date();
    let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
    if (timeDifference >= maxTime) {
      if (timeInterval) clearInterval(timeInterval);
      if (checkInterval) clearInterval(checkInterval);
      await duelManager.finishDuel(roomId);
      io.emit("status-change", {
        roomId: roomId,
        newStatus: "FINISHED",
      });
      return "Time's up.";
    }
    return Math.ceil((maxTime - timeDifference) / 1000);
  }
}

export default SocketManager;
