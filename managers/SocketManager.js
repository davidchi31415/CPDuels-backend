import DuelManager from "./DuelManager.js";
import TaskManager from "./TaskManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import duelModel, { submissionModel } from "../models/models.js";

class SocketManager {
	constructor(io) {
		this.codeforcesAPI = new CodeforcesAPI();
		const taskManager = new TaskManager(this.codeforcesAPI);
		const duelManager = new DuelManager(this.codeforcesAPI, taskManager);
		this.timers = {};
		// taskManager.init();
		setInterval(async () => {
			let updatedCFSubmissions =
				await this.codeforcesAPI.updateSubmissions();
			if (updatedCFSubmissions?.length) {
				for (const item of updatedCFSubmissions) {
					await duelManager.updateProblem(
						item.duelId,
						item.uid,
						item.problemNumber,
						item.status,
						item.createdAt
					);
					io.emit("submission-change", { duelId: item.duelId });
				}
			}
		}, 10000);
		this.io = io;
		io.on("connection", async (socket) => {
			socket.on("join", (roomId) => {
				socket.join(roomId);
			});
			socket.on("join-duel", async ({ roomId, username, guest, uid }) => {
				let duel = await duelManager.getDuel(roomId);
				let duelState = duel.status;
				if (duelState === "WAITING") {
					console.log(username + " Wants to Join Duel " + roomId);
					let validJoin = await duelManager.isValidJoinRequest(
						roomId,
						username,
						guest,
						duel.filter
					);
					if (validJoin[0]) {
						await duelManager.addDuelPlayer(
							roomId,
							username,
							guest,
							uid
						);
						await duelManager.initializeDuel(roomId);
						io.emit("status-change", {
							roomId: roomId,
							newStatus: "INITIALIZED",
						});
					} else {
						io.to(socket.id).emit("join-duel-error", {
							message: validJoin[1],
						});
					}
				}
			});
			socket.on("player-ready", async ({ roomId, uid }) => {
				let duel = await duelManager.getDuel(roomId);
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
          io.emit("player-ready-changed", ({ roomId }));
					let duelReady = await duelManager.getDuelReadyStatus(
						roomId
					);
					if (duelReady) {
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
						this.timers[roomId] = setInterval(async () => {
							let timeLeft = await this.getTimeLeft(
								startTime,
								maxTime,
								this.timers[roomId],
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
				}
			});

			socket.on("player-unready", async ({ roomId, uid }) => {
				let duel = await duelManager.getDuel(roomId);
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
        io.emit("player-ready-changed", ({ roomId }));
			});
			socket.on(
				"regenerate-problem",
				async ({ roomId, problemNumbers }) => {
					// regenerate problem with array of problemNumbers
          let duel = await duelManager.getDuel(roomId);
          await taskManager.regenerateProblems(duel, problemNumbers);
				}
			);
			socket.on("submit-problem", async ({ roomId, uid, submission }) => {
				console.log(
					`Duel ${roomId}, player with uid ${uid} is submitting a problem.`
				);
				try {
					console.log(roomId);
					let duel = await duelManager.getDuel(roomId);
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
						let submitted = await duelManager.submitProblem(
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
								message: "Could not submit. Try again.",
							});
						}
					} else {
						console.log(
							`Not a valid uid for submission to Duel ${roomId}`
						);
						io.emit("problem-submitted-error", {
							roomId: roomId,
							uid: uid,
							message:
								"You are not recognized as a duel participant",
						});
					}
				} catch (e) {
					console.log(
						`Error submitting problem in Duel ${roomId}: ${e}`
					);
				}
			});
			socket.on("abort-duel", async ({ roomId, uid }) => {
				console.log(
					`Duel ${roomId}, player with uid ${uid} is aborting duel.`
				);

				try {
					let duel = await duelManager.getDuel(roomId);
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
						await duelManager.abortDuel(roomId);
						if (this.timers[roomId])
							clearInterval(this.timers[roomId]);
						io.emit("status-change", {
							roomId: roomId,
							newStatus: "ABORTED",
						});
					} else {
						console.log(
							`Not a valid uid for aborting Duel ${roomId}`
						);
						io.emit("abort-duel-error", {
							roomId: roomId,
							uid: uid,
							message:
								"You are not recognized as a duel participant",
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
						await duelManager.resignDuel(roomId, uid);
						if (this.timers[roomId])
							clearInterval(this.timers[roomId]);
						io.emit("status-change", {
							roomId: roomId,
							newStatus: "FINISHED",
						});
					} else {
						console.log(
							`Not a valid uid for resigning Duel ${roomId}`
						);
						io.emit("resign-duel-error", {
							roomId: roomId,
							uid: uid,
							message:
								"You are not recognized as a duel participant",
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
							message:
								"You are not recognized as a duel participant",
						});
				} catch (e) {
					console.log(
						`Error sending message in Duel ${roomId}: ${e}`
					);
				}
			});
			socket.on(
				"message-typing-send",
				async ({ roomId, uid, author }) => {
					try {
						io.emit("message-typing-receive", {
							roomId: roomId,
							senderUid: uid,
							author: author,
						});
					} catch (e) {
						console.log(
							`Error typing a message in Duel ${roomId}: ${e}`
						);
					}
				}
			);
		});
	}

	async init() {
		await this.codeforcesAPI.init();
	}

	async getTimeLeft(
		startTime,
		maxTime,
		timeInterval,
		roomId,
		io,
		duelManager
	) {
		let finishStatus = await duelManager.getDuelFinishStatus(roomId);
		const curTime = new Date();
		let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
		if (timeDifference >= maxTime || finishStatus) {
			if (timeInterval) clearInterval(timeInterval);
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
