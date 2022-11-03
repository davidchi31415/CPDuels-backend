import db from "../server.js";
import { ObjectId } from "mongodb";
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
				.find(
					{
						_id: ObjectId(id),
					},
					{}
				)
				.toArray();
			if (duels.length != 0) return duels[0];
		} catch (err) {
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
		// if (!validTimeLimit) {
		// 	return [false, "Invalid Time Limit"];
		// }
		let validParams;
		if (platform === "CF") {
			validParams = [true, "asdf"];
			// validParams = await codeforcesAPI.checkDuelParams(
			// 	players[0].username,
			// 	ratingMin,
			// 	ratingMax
			// );
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

	async isValidJoinRequest(duelId, username) {
		let duel = await this.getDuel(duelId);

		if (duel.players.length === 2) {
			// username multiple players joining at once
			return [false, "Duel Full"];
		}
		let owner = duel.players[0];
		if (owner.username === username) {
			return [false, "Duplicate Usernames"];
		}
		// let validUsername;
		// if (duel.platform === "CF") {
		// 	validUsername = await codeforcesAPI.checkUsername(username);
		// } else if (duel.platform === "AT") {
		// 	// validUsername = await AtcoderAPI.checkUsername(username);
		// } else {
		// 	// validUsername = await LeetcodeAPI.checkUsername(username);
		// }
		// if (!validUsername[0]) {
		// 	return [false, validUsername[1]];
		// }
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
		await db.collection("duels").findOneAndUpdate(
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
		await db.collection("duels").findOneAndUpdate(
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

	async finishDuel(id) {
		await this.changeDuelState(id, "FINISHED");
		await this.checkProblemSolves(id);
		let winner = await this.findWinner(id);
		await db.collection("duels").findOneAndUpdate(
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

	async addDuelPlayer(id, username, uid) {
		await db.collection("duels").findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$push: {
					players: {
						username: username,
						uid: uid,
					},
				},
			}
		);
	}

	async addProblems(id) {
		let duel = await this.getDuel(id);
		let problems = await this.taskManager.createDuelProblems(duel);

		/* Points
        Each problem's points is equal to the amount of rating above the rating range minimum, plus 100
        If the rating range delta is 0, each problem is worth 100 points
        */
		for (let i = 0; i < problems.length; i++) {
			problems[i].points = problems[i].rating - duel.ratingMin + 100;
			problems[i].playerOneScore = 0;
			problems[i].playerTwoScore = 0;
			problems[i].playerOneAttempts = 0;
			problems[i].playerTwoAttempts = 0;
		}

		await db.collection("duels").findOneAndUpdate(
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

	async updateProblemScores(playerNum, solves, id) {
		/* Scores
        Each attempt increases attempt number. Only correct submissions affect score.
        Attempt number increases penalty (10%). If a player gets it right once, submissions afterwards
        do not affect score. The player's score is bounded below by 0.
        */

		// go through all submissions and for each problem check if solved
		// if solved skip submission, otherwise check if verdict is OK which will
		//duel.problems[i].contestId, duel.problems[i].index
		let duel = await this.getDuel(id);
		let problems = duel.problems;
		if (!problems) return; // problems undefined bug
		if (playerNum === 0) {
			// recalculate the number of attempts if problem not solved
			problems = problems.map((problem) => {
				return {
					...problem,
					playerOneAttempts:
						problem.playerOneScore === 0
							? 0
							: problem.playerOneAttempts,
				};
			});
			for (let i = 0; i < solves.length; i++) {
				for (let k = 0; k < problems.length; k++) {
					if (problems[k].playerOneScore > 0) continue; // if player already solved, stop considering
					if (
						solves[i].index === problems[k].index &&
						solves[i].contestId === problems[k].contestId
					) {
						// submission for problem match
						if (
							!solves[i].verdict ||
							solves[i].verdict === "TESTING"
						) {
							continue;
						}
						if (solves[i].verdict === "OK") {
							let penalty =
								problems[k].playerOneAttempts *
								0.1 *
								problems[k].points;
							problems[k].playerOneScore = Math.max(
								0,
								problems[k].points - penalty
							);
						}
						problems[k].playerOneAttempts++;
					}
				}
			}
		} else {
			// player two
			// recalculate the number of attempts if problem not solved
			problems = problems.map((problem) => {
				return {
					...problem,
					playerTwoAttempts:
						problem.playerTwoScore === 0
							? 0
							: problem.playerTwoAttempts,
				};
			});
			for (let i = 0; i < solves.length; i++) {
				for (let k = 0; k < problems.length; k++) {
					if (problems[k].playerTwoScore > 0) continue; // if player already solved, stop considering
					if (
						solves[i].index === problems[k].index &&
						solves[i].contestId === problems[k].contestId
					) {
						// submission for problem match
						if (
							!solves[i].verdict ||
							solves[i].verdict === "TESTING"
						) {
							continue;
						}
						if (solves[i].verdict === "OK") {
							let penalty =
								problems[k].playerTwoAttempts *
								0.1 *
								problems[k].points;
							problems[k].playerTwoScore = Math.max(
								0,
								problems[k].points - penalty
							);
						}
						problems[k].playerTwoAttempts++;
					}
				}
			}
		}

		await db.collection("duels").findOneAndUpdate(
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

	async updateDuelScores(id) {
		let duel = await this.getDuel(id);
		let playerOneScore = 0;
		let playerTwoScore = 0;
		let playerOneSolves = 0;
		let playerTwoSolves = 0;
		for (let i = 0; i < duel.problems.length; i++) {
			playerOneScore += duel.problems[i].playerOneScore;
			playerTwoScore += duel.problems[i].playerTwoScore;
			if (duel.problems[i].playerOneScore) playerOneSolves++;
			if (duel.problems[i].playerTwoScore) playerTwoSolves++;
		}
		await db.collection("duels").findOneAndUpdate(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					playerOneScore: playerOneScore,
					playerTwoScore: playerTwoScore,
					playerOneSolves: playerOneSolves,
					playerTwoSolves: playerTwoSolves,
				},
			}
		);
	}

	async checkProblemSolves(id) {
		let duel = await this.getDuel(id);
		let playerOneSolves = await this.taskManager.getUserSolves(
			duel,
			duel.players[0].username
		);
		let playerTwoSolves = await this.taskManager.getUserSolves(
			duel,
			duel.players[1].username
		);
		//duel.problems[i].contestId, duel.problems[i].index
		if (playerOneSolves) {
			await this.updateProblemScores(0, playerOneSolves, id);
		}
		if (playerTwoSolves) {
			await this.updateProblemScores(1, playerTwoSolves, id);
		}
		await this.updateDuelScores(id);
	}

	async findWinner(id) {
		let duel = await this.getDuel(id);
		if (duel.playerOneScore > duel.playerTwoScore) {
			return ["WON", duel.players[0].username];
		} else if (duel.playerTwoScore > duel.playerOneScore) {
			return ["WON", duel.players[1].username];
		} else {
			return ["TIE"];
		}
	}

	async submitProblem(id, uid, submission) {
		console.log("trying to submit problem");
		try {
			let duel = await this.getDuel(id);
			await this.taskManager.submitProblem(duel, uid, submission);
			return [true];
		} catch (e) {
			console.log(
				`Duel ${id} player with uid ${uid} failed to submit problem: ${e}`
			);
			return [false, e];
		}
	}
}

export default DuelManager;
