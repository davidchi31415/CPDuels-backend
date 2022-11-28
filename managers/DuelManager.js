import db from "../server.js";
import { ObjectId } from "mongodb";
import duelModel from "../models/models.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
// import languages from "./languages.js";

class DuelManager {
	constructor(codeforcesAPI, taskManager) {
		this.codeforcesAPI = codeforcesAPI;
		this.taskManager = taskManager;
	}

	async getDuel(id) {
		try {
			let duels = await db
				.collection("duels")
				.find({ _id: ObjectId(id) })
				.toArray();
			if (duels.length != 0) return duels[0];
		} catch (err) {
			console.log(err);
			console.log(
				"Error: invalid getDuel() request... Probably an invalid id."
			);
		}
		return null; // if no duel found
	}
	static async isValidDuelRequest(
		platform,
		players,
		problemCount,
		ratingMin,
		ratingMax,
		timeLimit
	) {
		let validProblemCount =
			problemCount && problemCount >= 1 && problemCount <= 10;
		if (!validProblemCount) {
			return [false, "Invalid Problem Count"];
		}
		let validTimeLimit = timeLimit && timeLimit >= 5 && timeLimit <= 180;
		if (!validTimeLimit) {
			return [false, "Invalid Time Limit"];
		}
		let validParams;
		if (platform === "CF") {
			validParams = await CodeforcesAPI.checkDuelParams(
				players[0].username,
				players[0].guest,
				ratingMin,
				ratingMax
			);
		} else if (platform === "AT") {
			// validParams = await AtcoderAPI.checkDuelParams(players[0].username, ratingMin, ratingMax);
		} else if (platform === "LC") {
			// validParams = await LeetcodeAPI.checkDuelParams(players[0].username, ratingMin, ratingMax);
		} else {
			return [false, "Invalid Platform"];
		}
		if (!validParams[0]) return [false, validParams[1]];
		return [true];
	}

	async isValidJoinRequest(duelId, username, guest) {
		let duel = await this.getDuel(duelId);

		if (duel.players.length === 2) {
			// username multiple players joining at once
			return [false, "Duel Full"];
		}
		if (guest) return [true]; // Skip the username checking if it is a guest join request
		let owner = duel.players[0];
		if (owner.username === username) {
			return [false, "Duplicate Usernames"];
		}
		let validUsername;
		if (duel.platform === "CF") {
			validUsername = await this.codeforcesAPI.checkUsername(username);
		}
		// else if (duel.platform === "AT") {
		// 	// validUsername = await AtcoderAPI.checkUsername(username);
		// } else {
		// 	// validUsername = await LeetcodeAPI.checkUsername(username);
		// }
		if (!validUsername[0]) {
			return [false, validUsername[1]];
		}
		return [true];
	}

	async getDuelState(id) {
		try {
			let duels = await db
				.collection("duels")
				.find(
					{
						_id: ObjectId(id),
					},
					{}
				)
				.toArray();
			if (duels.length != 0) return duels[0].status;
		} catch (err) {
			console.log(
				"Error: invalid getDuelState() request... Probably an invalid id."
			);
		}
		return null; // if no duel found
	}

	async changeDuelState(id, state) {
		console.log("Duel " + id + " State Changed to " + state);
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					status: state,
				},
			}
		);
	}

	async startDuel(id) {
		await this.changeDuelState(id, "ONGOING");
		var startTime = new Date().getTime() / 1000;
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					startTime: startTime,
				},
			}
		);
		await this.addProblems(id);
	}

	async abortDuel(id) {
		await this.changeDuelState(id, "ABORTED");
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					result: ["ABORTED"],
				},
			}
		);
	}

	async resignDuel(id, uid) {
		await this.changeDuelState(id, "FINISHED");
		let duel = await this.getDuel(id);
		let winner = duel.players[0].username;
		if (uid === duel.players[1].uid) winner = duel.players[1].uersname;
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					result: ["RESIGNED", winner],
				},
			}
		);
	}

	async finishDuel(id) {
		await this.changeDuelState(id, "FINISHED");
		await this.checkProblemSolves(id);
		let winner = await this.findWinner(id);
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					result: winner,
				},
			}
		);
	}

	async addDuelPlayer(id, username, guest, uid) {
		let renamePlayerOne = false;
		if (guest) {
			let duel = await this.getDuel(id);
			if (duel.players[0].guest) {
				renamePlayerOne = true;
				username = "GUEST2";
			} else username = "GUEST";
		}
		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$push: {
					players: {
						username: username,
						uid: uid,
						score: 0,
						guest: guest,
						solveCount: 0,
						attemptCount: 0,
					},
				},
			}
		);
		if (renamePlayerOne)
			await duelModel.findOneAndUpdate(
				{
					_id: ObjectId(id),
				},
				{
					$set: {
						"players.0.username": "GUEST1",
					},
				}
			);
	}

	async addProblems(id) {
		let duel = await this.getDuel(id);
		let problems = await this.taskManager.createDuelProblems(duel);
		console.log(problems);

		await duelModel.findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					problems: problems,
				},
			}
		);
	}

	// async updateProblemScores(playerNum, solves, id) {
	// 	/* Scores
	//       Each attempt increases attempt number. Only correct submissions affect score.
	//       Attempt number increases penalty (10%). If a player gets it right once, submissions afterwards
	//       do not affect score. The player's score is bounded below by 0.
	//       */

	// 	// go through all submissions and for each problem check if solved
	// 	// if solved skip submission, otherwise check if verdict is OK which will
	// 	//duel.problems[i].contestId, duel.problems[i].index
	// 	let duel = await this.getDuel(id);
	// 	let problems = duel.problems;
	// 	if (!problems) return; // problems undefined bug
	// 	if (playerNum === 0) {
	// 		// recalculate the number of attempts if problem not solved
	// 		problems = problems.map((problem) => {
	// 			return {
	// 				...problem,
	// 				playerOneAttempts:
	// 					problem.playerOneScore === 0
	// 						? 0
	// 						: problem.playerOneAttempts,
	// 			};
	// 		});
	// 		for (let i = 0; i < solves.length; i++) {
	// 			for (let k = 0; k < problems.length; k++) {
	// 				if (problems[k].playerOneScore > 0) continue; // if player already solved, stop considering
	// 				if (
	// 					solves[i].index === problems[k].index &&
	// 					solves[i].contestId === problems[k].contestId
	// 				) {
	// 					// submission for problem match
	// 					if (
	// 						!solves[i].verdict ||
	// 						solves[i].verdict === "TESTING"
	// 					) {
	// 						continue;
	// 					}
	// 					if (solves[i].verdict === "OK") {
	// 						let penalty =
	// 							problems[k].playerOneAttempts *
	// 							0.1 *
	// 							problems[k].points;
	// 						problems[k].playerOneScore = Math.max(
	// 							0,
	// 							problems[k].points - penalty
	// 						);
	// 					}
	// 					problems[k].playerOneAttempts++;
	// 				}
	// 			}
	// 		}
	// 	} else {
	// 		// player two
	// 		// recalculate the number of attempts if problem not solved
	// 		problems = problems.map((problem) => {
	// 			return {
	// 				...problem,
	// 				playerTwoAttempts:
	// 					problem.playerTwoScore === 0
	// 						? 0
	// 						: problem.playerTwoAttempts,
	// 			};
	// 		});
	// 		for (let i = 0; i < solves.length; i++) {
	// 			for (let k = 0; k < problems.length; k++) {
	// 				if (problems[k].playerTwoScore > 0) continue; // if player already solved, stop considering
	// 				if (
	// 					solves[i].index === problems[k].index &&
	// 					solves[i].contestId === problems[k].contestId
	// 				) {
	// 					// submission for problem match
	// 					if (
	// 						!solves[i].verdict ||
	// 						solves[i].verdict === "TESTING"
	// 					) {
	// 						continue;
	// 					}
	// 					if (solves[i].verdict === "OK") {
	// 						let penalty =
	// 							problems[k].playerTwoAttempts *
	// 							0.1 *
	// 							problems[k].points;
	// 						problems[k].playerTwoScore = Math.max(
	// 							0,
	// 							problems[k].points - penalty
	// 						);
	// 					}
	// 					problems[k].playerTwoAttempts++;
	// 				}
	// 			}
	// 		}
	// 	}

	// 	await duelModel.findOneAndUpdate(
	// 		{
	// 			_id: ObjectId(id),
	// 		},
	// 		{
	// 			$set: {
	// 				problems: problems,
	// 			},
	// 		}
	// 	);
	// }

	// async checkProblemSolves(id) {
	// 	let duel = await this.getDuel(id);
	// 	let playerOneSolves = await this.taskManager.getUserSolves(
	// 		duel,
	// 		duel.players[0].username
	// 	);
	// 	let playerTwoSolves = await this.taskManager.getUserSolves(
	// 		duel,
	// 		duel.players[1].username
	// 	);
	// 	//duel.problems[i].contestId, duel.problems[i].index
	// 	if (playerOneSolves) {
	// 		await this.updateProblemScores(0, playerOneSolves, id);
	// 	}
	// 	if (playerTwoSolves) {
	// 		await this.updateProblemScores(1, playerTwoSolves, id);
	// 	}
	// 	await this.updateDuelScores(id);
	// }

	async findWinner(id) {
		let duel = await this.getDuel(id);
		if (duel.players[0].score > duel.players[1].score) {
			return ["WON", duel.players[0].username];
		} else if (duel.players[1].score > duel.players[0].score) {
			return ["WON", duel.players[1].username];
		} else {
			return ["TIE"];
		}
	}

	////////////////////////////////////////////////////////////////////////
	// Submitting

	async submitProblem(id, uid, submission) {
		console.log("trying to submit problem");
		try {
			let duel = await this.getDuel(id);
			let problem = duel.problems[parseInt(submission.number) - 1];
			let submitted = await this.codeforcesAPI.puppeteerSubmitProblem(
				problem.contestId,
				problem.index,
				problem.name,
				submission.number,
				submission.content,
				submission.languageCode,
				id,
				uid
			);
			return submitted;
		} catch (e) {
			console.log(
				`Duel ${id} player with uid ${uid} failed to submit problem: ${e}`
			);
			return [false, e];
		}
	}

	////////////////////////////////////////////////////////////////////////
	// Updating
	async getPlayerNumber(duelId, uid) {
		let duel = await this.getDuel(duelId);
		let playerNum = false;
		for (let i = 0; i < duel.players.length; i++) {
			if (duel.players[i].uid === uid) return i + 1;
		}
		return playerNum;
	}

	async updateProblem(duelId, uid, problemNumber, status, submissionTime) {
		// Check if necessary to update
		if (status[0] === "PENDING") return; // Don't update if the status is still pending
		let duel = await this.getDuel(duelId);
		let playerNumber = await this.getPlayerNumber(duelId, uid); // 1-indexed
		let playerIndex = playerNumber - 1;
		let problemIndex = problemNumber - 1;
		let problemToUpdate = duel.problems[problemIndex];
		if (problemToUpdate.playerSolveTimes[playerIndex]) return; // Don't update if the player has already solve this problem

		// Update problem data in duel
		let setSolved = `problems.${problemIndex}.playerSolveTimes.${playerIndex}`;
		let setAttempts = `problems.${problemIndex}.playerAttempts.${playerIndex}`;
		await duelModel.findOneAndUpdate(
			{
				// Increment attempt count no matter if accepted or wrong
				_id: duelId,
			},
			{
				$inc: {
					[setAttempts]: 1,
				},
			}
		);
		if (status[0] === "ACCEPTED") {
			await duelModel.findOneAndUpdate(
				{
					_id: duelId,
				},
				{
					$set: {
						[setSolved]: submissionTime.getTime() / 1000, // Since it is a date
					},
				}
			);
			console.log(submissionTime.getTime());
		}
		await this.updateDuelScores(duelId);
	}

	async updateDuelScores(duelId) {
		// Called from within updateProblem when a submission is updated
		let duel = await this.getDuel(duelId);
		let p1Score = 0;
		let p2Score = 0;
		for (let i = 0; i < duel.problems.length; i++) {
			p1Score += this.calculateScore(
				duel,
				duel.problems[i].playerSolveTimes[0]
			);
			p2Score += this.calculateScore(
				duel,
				duel.problems[i].playerSolveTimes[1]
			);
		}
		await duelModel.findOneAndUpdate(
			{
				_id: duelId,
			},
			{
				$set: {
					"players.0.score": p1Score,
					"players.1.score": p2Score,
				},
			}
		);
		console.log("Successfully updated duel scores");
	}

	calculateScore(duel, solveTime) {
		if (solveTime) {
			let timeToSolve = solveTime - duel.startTime;
			console.log(
				"🚀 ~ file: DuelManager.js ~ line 490 ~ DuelManager ~ calculateScore ~ timeToSolve",
				timeToSolve
			);
			let ratio = timeToSolve / (duel.timeLimit * 60000);
			console.log(
				"🚀 ~ file: DuelManager.js ~ line 491 ~ DuelManager ~ calculateScore ~ ratio",
				ratio
			);
			console.log(1 - ratio);
		}
		return 0;
	}

	// async updateDuelScores(id) {
	// 	let duel = await this.getDuel(id);
	// 	let playerOneScore = 0;
	// 	let playerTwoScore = 0;
	// 	let playerOneSolves = 0;
	// 	let playerTwoSolves = 0;
	// 	for (let i = 0; i < duel.problems.length; i++) {
	// 		playerOneScore += duel.problems[i].playerOneScore;
	// 		playerTwoScore += duel.problems[i].playerTwoScore;
	// 		if (duel.problems[i].playerOneScore) playerOneSolves++;
	// 		if (duel.problems[i].playerTwoScore) playerTwoSolves++;
	// 	}
	// 	await duelModel.findOneAndUpdate(
	// 		{
	// 			_id: ObjectId(id),
	// 		},
	// 		{
	// 			$set: {
	// 				playerOneScore: playerOneScore,
	// 				playerTwoScore: playerTwoScore,
	// 				playerOneSolves: playerOneSolves,
	// 				playerTwoSolves: playerTwoSolves,
	// 			},
	// 		}
	// 	);
	// }
}

export default DuelManager;
