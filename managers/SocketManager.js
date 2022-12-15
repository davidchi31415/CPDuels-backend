import DuelManager from "./DuelManager.js";
import TaskManager from "./TaskManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import LeetcodeAPI from "../utils/api/LeetcodeAPI.js";
import duelModel, { submissionModel } from "../models/models.js";
import { sleep } from "../utils/helpers/sleep.js";

class SocketManager {
  constructor(io) {
    this.codeforcesAPI = new CodeforcesAPI();
    this.leetcodeAPI = new LeetcodeAPI();
    const taskManager = new TaskManager(this.codeforcesAPI, this.leetcodeAPI);
    this.duelManager = new DuelManager(
      this.codeforcesAPI,
      this.leetcodeAPI,
      taskManager
    );
    this.timers = {};
    // taskManager.init();
    this.io = io;
    io.on("connection", async (socket) => {
      socket.on("join", (roomId) => {
        socket.join(roomId);
      });
      socket.on("join-duel", async ({ roomId, username, guest, uid }) => {
        let joinStatus = await DuelManager.isPlayerInDuel(uid);
				if (joinStatus.length) {
					io.to(socket.id).emit("join-duel-error", {
						message: "Already in a duel!", url: joinStatus[0],
					});
				} else {
          let duel = await this.duelManager.getDuel(roomId);
          let duelState = duel.status;
          if (duelState === "WAITING") {
            console.log(username + " Wants to Join Duel " + roomId);
            let validJoin = await this.duelManager.isValidJoinRequest(
              roomId,
              username,
              guest
            );
            if (validJoin[0]) {
              await this.duelManager.addDuelPlayer(roomId, username, guest, uid);
              await this.duelManager.initializeDuel(roomId);
              io.emit("status-change", {
                roomId: roomId,
                newStatus: "INITIALIZED",
              });
              io.emit("problem-change", { roomId: roomId });
            } else {
              io.to(socket.id).emit("join-duel-error", {
                message: validJoin[1],
              });
            }
          } else {
            io.to(socket.id).emit("join-duel-error", {
              message: "This duel cannot be joined."
            });
          }
        }
      });
      socket.on("player-ready", async ({ roomId, uid }) => {
        let duel = await this.duelManager.getDuel(roomId);
        if (duel.regeneratingProblems) return; // Do not allow duel to begin while regenerating problems.
        let playerNum;
        for (let i = 0; i < duel.players.length; i++) {
          if (duel.players[i].uid === uid) playerNum = i + 1;
        }
        if (playerNum) {
          let playerIndex = playerNum - 1;
          let setting = `players.${playerIndex}.ready`;
          await duelModel.findOneAndUpdate(
            { _id: roomId },
            {
              $set: {
                [setting]: true,
              },
            }
          );
          io.emit("player-ready-changed", { roomId });
          let duelReady = await this.duelManager.getDuelReadyStatus(roomId);
          if (duelReady) {
            let timeLimit = duel.timeLimit;
            const startTime = new Date();
            const maxTime = timeLimit * 60000; // minutes to milliseconds
            await this.duelManager.startDuel(roomId);

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
            this.timers[roomId] = setInterval(async () => {
              let timeLeft = await this.getTimeLeft(
                startTime,
                maxTime,
                this.timers[roomId],
                roomId,
                io,
                this.duelManager
              );
              io.emit("time-left", {
                roomId: roomId,
                timeLeft: timeLeft,
              });
            }, 1000);
          }
        }
      });

      socket.on("player-unready", async ({ roomId, uid }) => {
        let duel = await this.duelManager.getDuel(roomId);
        let playerNum;
        for (let i = 0; i < duel.players.length; i++) {
          if (duel.players[i].uid === uid) playerNum = i + 1;
        }
        if (playerNum) {
          let playerIndex = playerNum - 1;
          let setting = `players.${playerIndex}.ready`;
          await duelModel.findOneAndUpdate(
            { _id: roomId },
            {
              $set: {
                [setting]: false,
              },
            }
          );
        }
        io.emit("player-ready-changed", { roomId });
      });
      socket.on(
        "replace-problem-selected",
        ({ roomId, uid, updatedIndices }) => {
          io.emit("replace-problem-received", {
            roomId: roomId,
            uid: uid,
            updatedIndices: updatedIndices,
          });
        }
      );
      socket.on("regenerate-problems", async ({ roomId, problemIndices }) => {
        // regenerate problem with array of problemNumbers
        let duel = await this.duelManager.getDuel(roomId);
        console.log(roomId);
        io.emit("regenerate-problems-received", { roomId });
        await taskManager.regenerateProblems(duel, problemIndices);
        io.emit("regenerate-problems-completed", { roomId });
      });
      socket.on("submit-problem", async ({ roomId, uid, submission }) => {
        console.log(
          `Duel ${roomId}, player with uid ${uid} is submitting a problem.`
        );
        try {
          console.log(roomId);
          let duel = await this.duelManager.getDuel(roomId);
          let validDuel = duel.status === "ONGOING";
          if (!validDuel) {
            io.emit("problem-submitted-error", {
              roomId: roomId,
              uid: uid,
              message: "This duel cannot be submitted to.",
            });
            return;
          }
          let validPlayer = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) {
              validPlayer = true;
            }
          }
          if (validPlayer) {
            let submitted = await this.duelManager.submitProblem(
              roomId,
              uid,
              submission
            );
            if (submitted[0]) {
              io.emit("problem-submitted-success", {
                roomId: roomId,
                uid: uid,
              });
            } else {
              io.emit("problem-submitted-error", {
                roomId: roomId,
                uid: uid,
                message: submitted[1] ? submitted[1] : "Could not submit. Try again.",
              });
            }
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
          let duel = await this.duelManager.getDuel(roomId);
          let validDuel =
            duel.status === "WAITING" ||
            duel.status === "READY" ||
            duel.status === "INITIALIZED";
          if (!validDuel) {
            io.emit("abort-duel-error", {
              roomId: roomId,
              uid: uid,
              message: "This duel cannot be aborted.",
            });
            return;
          }
          let validPlayer = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) validPlayer = true;
          }
          if (validPlayer) {
            await this.duelManager.abortDuel(roomId);
            if (this.timers[roomId]) clearInterval(this.timers[roomId]);
            io.emit("status-change", {
              roomId: roomId,
              newStatus: "ABORTED",
            });
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
          let duel = await this.duelManager.getDuel(roomId);
          let validDuel = duel.status === "ONGOING";
          if (!validDuel) {
            io.emit("resign-duel-error", {
              roomId: roomId,
              uid: uid,
              message: "This duel cannot be resigned.",
            });
            return;
          }
          let validPlayer = false;
          for (let i = 0; i < duel.players.length; i++) {
            if (duel.players[i].uid === uid) validPlayer = true;
          }
          if (validPlayer) {
            await this.duelManager.resignDuel(roomId, uid);
            if (this.timers[roomId]) clearInterval(this.timers[roomId]);
            io.emit("status-change", {
              roomId: roomId,
              newStatus: "FINISHED",
            });
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
          let duel = await this.duelManager.getDuel(roomId);
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
    await this.leetcodeAPI.init();
    while (true) {
      await sleep(1000);
      let updatedCFSubmissions = await this.codeforcesAPI.updateSubmissions();
      if (updatedCFSubmissions?.length) {
        for (const item of updatedCFSubmissions) {
          await this.duelManager.updateProblem(
            item.duelId,
            item.uid,
            item.problemNumber,
            item.status,
            item.createdAt
          );
          this.io.emit("submission-change", { duelId: item.duelId });
        }
      }
      let updatedLCSubmissions = await this.leetcodeAPI.updateSubmissions();
      if (updatedLCSubmissions?.length) {
        for (const item of updatedLCSubmissions) {
          await this.duelManager.updateProblem(
            item.duelId,
            item.uid,
            item.problemNumber,
            item.status,
            item.createdAt
          );
          this.io.emit("submission-change", { duelId: item.duelId });
        }
      }
    }
  }

  async getTimeLeft(startTime, maxTime, timeInterval, roomId, io, duelManager) {
    let finishStatus = await this.duelManager.getDuelFinishStatus(roomId);
    const curTime = new Date();
    let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
    if (timeDifference >= maxTime || finishStatus) {
      if (timeInterval) clearInterval(timeInterval);
      await this.duelManager.finishDuel(roomId);
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
