import db from "../server.js";
import { ObjectId } from "mongodb";
import duelModel from "../models/models.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import LeetcodeAPI from "../utils/api/LeetcodeAPI.js";
import { allowedOrigins } from "../config/origins.js";
// import languages from "./languages.js";

class DuelManager {
  constructor(codeforcesAPI, leetcodeAPI, taskManager) {
    this.codeforcesAPI = codeforcesAPI;
    this.leetcodeAPI = leetcodeAPI;
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
      validParams = CodeforcesAPI.checkDuelParams(ratingMin, ratingMax);
    } else if (platform === "AT") {
      // validParams = await AtcoderAPI.checkDuelParams(players[0].username, ratingMin, ratingMax);
    } else if (platform === "LC") {
      validParams = LeetcodeAPI.checkDuelParams(ratingMin, ratingMax);
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

  async initializeDuel(id) {
    await this.changeDuelState(id, "INITIALIZED");
    await this.addProblems(id);
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
    if (uid === duel.players[0].uid) winner = duel.players[1].username;
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
    // await this.checkProblemSolves(id);
    // await this.codeforcesAPI.updateSubmissions();
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

  static async isPlayerInDuel(uid) {
		let duels = await duelModel.find({
			status: { $in: ["ONGOING", "WAITING", "INITIALIZED"] },
		});
    let result = [];
		for (let duel of duels) {
			for (let player of duel.players) {
				if (player.uid === uid) {
					let url = allowedOrigins + `/play/${duel._id}`;
          result.push(url);
        }
			}
		}
		return result;
	}

  ////////////////////////////////////////////////////////////////////////
  // Submitting

  async getSubmissionsRequestsFromDatabase() {
    let result = await db
      .collection("submissionrequests")
      .find()
      .toArray();
    return result;
  }

  async fulfillSubmitRequests() {
    let submissionRequests = await this.getSubmissionsRequestsFromDatabase();
    let submissions = [];
    if (!submissionRequests.length) {
      console.log("No submission requests to fulfill.");
    }
    let lcCount = 0;
    for (const request of submissionRequests) {
      let submitted;
      try {
        let duel = await this.getDuel(request.duelId);
        let problem = duel.problems[parseInt(request.problemNumber) - 1];  
        if (duel.platform === "CF") {
          submitted = await this.codeforcesAPI.puppeteerSubmitProblem(
            problem.accessor.contestId,
            problem.accessor.index,
            problem.name,
            request.problemNumber,
            request.content,
            request.languageCode,
            request.duelId,
            request.uid
          );
        } else if (duel.platform === "LC") {
          submitted = await this.leetcodeAPI.puppeteerSubmitProblem(
            problem.accessor.slug,
            problem.name,
            request.problemNumber,
            request.content,
            request.languageName, // String (e.g., "C++"),
            request.duelId,
            request.uid
          );
          lcCount++;
        } else {
          // AtCoder
        }
        submissions.push({
          status: submitted,
          duelId: request.duelId,
          uid: request.uid
        });
      } catch (e) {
        console.log(
          `Duel ${request.duelId} player with uid ${request.uid} failed to submit problem: ${e}`
        );
        submissions.push({
          status: [false, "Could not submit. Please try again."],
          duelId: request.duelId,
          uid: request.uid
        });
      }
      await db.collection("submissionrequests").deleteOne({ _id: request._id });
    }
    return submissions;
  }

  ////////////////////////////////////////////////////////////////////////
  // Updating
  async getPlayerNumber(duel, uid) {
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
    let playerNumber = await this.getPlayerNumber(duel, uid); // 1-indexed
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
      let p1ProblemScore = this.calculatePlayerScoreForProblem(
        duel,
        duel.problems[i].duelPoints,
        duel.problems[i].playerAttempts[0],
        duel.problems[i].playerSolveTimes[0]
      );
      p1Score += p1ProblemScore;

      let p2ProblemScore = this.calculatePlayerScoreForProblem(
        duel,
        duel.problems[i].duelPoints,
        duel.problems[i].playerAttempts[0],
        duel.problems[i].playerSolveTimes[1]
      );
      p2Score += p2ProblemScore;

      let setP1ProblemScore = `problems.${i}.playerScores.0`;
      let setP2ProblemScore = `problems.${i}.playerScores.1`;
      await duelModel.findOneAndUpdate(
        {
          _id: duelId,
        },
        {
          $set: {
            [setP1ProblemScore]: p1ProblemScore,
            [setP2ProblemScore]: p2ProblemScore,
          },
        }
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

  calculatePlayerScoreForProblem(duel, problemPoints, attempts, solveTime) {
    if (solveTime) {
      let timeToSolve = solveTime - duel.startTime;
      console.log("Time to solve: ", timeToSolve);
      let ratio = 1 - timeToSolve / (duel.timeLimit * 60);
      console.log("Ratio: ", ratio);
      let rawScore = Math.floor(ratio * problemPoints);
      console.log("Raw score: ", rawScore);
      let finalScore = Math.max(0, rawScore - (attempts - 1) * 50); // 50 points off per wrong submission
      console.log("Final score: ", finalScore);
      return finalScore;
    }
    return 0;
  }

  async getDuelFinishStatus(duelId) {
    // returns true if both players have completed all problems
    let duel = await this.getDuel(duelId);
    return (
      this.getPlayerSolves(duel, 0) === duel.problems.length &&
      this.getPlayerSolves(duel, 1) === duel.problems.length
    );
  }

  async getDuelReadyStatus(duelId) {
    // returns true if both players have readied up.
    let duel = await this.getDuel(duelId);

    let playerOneReady = duel.players[0].ready;
    let playerTwoReady = duel.players[1].ready;

    return playerOneReady && playerTwoReady;
  }

  getPlayerSolves(duel, playerNum) {
    let solves = 0;
    for (let i = 0; i < duel.problems.length; i++) {
      if (duel.problems[i].playerSolveTimes[playerNum]) {
        solves++;
      }
    }
    return solves;
  }
}

export default DuelManager;
