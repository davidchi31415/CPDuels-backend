import db from "../server.js";
import CodeforcesAPI from "./codeforcesAPI.js";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import TaskManager from "./taskManager.js";


class DuelManager {

    static async findDuel(id) {
        try {
            let duels = await db.collection('duels').find({
                _id: ObjectId(id)
            }, {}).toArray();
            if (duels.length != 0 ) return duels[0];
        } catch (err) {
            console.log("Error: invalid getDuelState() request... Probably an invalid id.");
        }
        return null; // if no duel found
    }

    static async getDuelState(id) {
        try {
            let duels = await db.collection('duels').find({
                _id: ObjectId(id)
            }, {}).toArray();
            if (duels.length != 0 ) return duels[0].status;
        } catch (err) {
            console.log("Error: invalid getDuelState() request... Probably an invalid id.");
        }
        return null; // if no duel found
    }

    static async changeDuelState(id, state) {
        console.log('Duel ' + id + ' State Changed to ' + state);
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    status: state
                }
            }
        );
    }

    static async startDuel(id) {
        await this.changeDuelState(id, 'ONGOING');
        var startTime = new Date().getTime() / 1000;
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    startTime: startTime
                }
            }
        );
        await this.addProblems(id);
    }

    static async finishDuel(id) {
        await this.changeDuelState(id, 'FINISHED');
        await this.checkProblemSolves(id);
        let winner = await this.findWinner(id);
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    result: winner
                }
            }
        );
    }

    static async addDuelPlayer(id, handle, uid) {
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $push: {
                    players: {
                        handle: handle,
                        uid: uid
                    }
                }
            }
        );
    }

    static async addProblems(id) {
        let duel = await this.findDuel(id);
        let handles = [duel.players[0].handle, duel.players[1].handle];
        let problems = await TaskManager.getDuelProblems(duel.problemCount, handles, duel.ratingMin, duel.ratingMax);

        /* Points
        Each problem's points is equal to the amount of rating above the rating range minimum, plus 100
        If the rating range delta is 0, each problem is worth 100 points
        */
        for (let i = 0; i < problems.length; i++) {
            problems[i].points = (problems[i].rating - duel.ratingMin) + 100;
            problems[i].playerOneScore = 0;
            problems[i].playerTwoScore = 0;
            problems[i].playerOneAttempts = 0;
            problems[i].playerTwoAttempts = 0;
        }

        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    problems: problems
                }
            }
        );
    }

    static async updateProblemScores(id, playerNum, problemNum, solves) {
        /* Scores
        Each attempt increases attempt number. Only correct submissions affect score.
        Attempt number increases penalty (10%). If a player gets it right once, submissions afterwards
        do not affect score. The player's score is bounded below by 0.
        */
        let duel = await this.findDuel(id); let problems = duel.problems;
        if (!problems) return; // problems undefined bug
        if (playerNum === 0) {
            if (problems[problemNum].playerOneScore > 0) return; // if player has gotten ac, stop considering
            for (let i = 0; i < solves.length; i++) {
                if (solves[i].verdict === 'TESTING') continue;
                if (solves[i].verdict === 'OK') {
                    let penalty = problems[problemNum].playerOneAttempts * 0.1 * problems[problemNum].points;
                    problems[problemNum].playerOneScore = Math.max(0, problems[problemNum].points - penalty);
                    problems[problemNum].playerOneAttempts++;
                    break;
                }
                problems[problemNum].playerOneAttempts++;
            }
        }
        else {
            if (problems[problemNum].playerTwoScore > 0) return;
            for (let i = 0; i < solves.length; i++) {
                if (solves[i].verdict === 'TESTING') continue;
                if (solves[i].verdict === 'OK') {
                    let penalty = problems[problemNum].playerTwoAttempts * 0.1 * problems[problemNum].points;
                    problems[problemNum].playerTwoScore = Math.max(0, problems[problemNum].points - penalty);
                    problems[problemNum].playerTwoAttempts++;
                    break;
                }
                problems[problemNum].playerTwoAttempts++;
            }
        }
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    problems: problems
                }
            }
        );
    }

    static async updateDuelScores(id) {
        let duel = await this.findDuel(id);
        let playerOneScore = 0; let playerTwoScore = 0;
        for (let i = 0; i < duel.problems.length; i++) {
            playerOneScore += duel.problems[i].playerOneScore;
            playerTwoScore += duel.problems[i].playerTwoScore;
        }
        await db.collection('duels').findOneAndUpdate(
            {
                _id: ObjectId(id)
            },
            {
                $set: {
                    playerOneScore: playerOneScore,
                    playerTwoScore: playerTwoScore
                }
            }
        );
    }

    static async checkProblemSolves(id) {
        let duel = await this.findDuel(id);
        for (let i = 0; i < duel.problems.length; i++) {
            let playerOneSolves = await TaskManager.getUserSolves(
                id, duel.players[0].handle, duel.problems[i].contestId, duel.problems[i].index
            );
            let playerTwoSolves = await TaskManager.getUserSolves(
                id, duel.players[1].handle, duel.problems[i].contestId, duel.problems[i].index
            );
            if (playerOneSolves) {
                await this.updateProblemScores(id, 0, i, playerOneSolves);
            }
            if (playerTwoSolves) {
                await this.updateProblemScores(id, 1, i, playerTwoSolves);
            }
        }
        await this.updateDuelScores(id);
    }
    
    static async findWinner(id) {
        let duel = await this.findDuel(id);
        if (duel.playerOneScore > duel.playerTwoScore) {
            return ["WON", duel.players[0].handle];
        } else if (duel.playerTwoScore > duel.playerOneScore) {
            return ["WON", duel.players[1].handle];
        } else {
            return ["TIE"];
        }
    }

    static async isValidJoinRequest(id, handle) {
        let duel = await this.findDuel(id);
        if (duel.players.length === 2) { // handle multiple players joining at once
            return [false, "Duel Full"];
        }
        let owner = duel.players[0];
        if (owner.handle === handle) {
            return [false, "Duplicate Handles"];
        }
        let validHandle = await CodeforcesAPI.check_handle(handle);
        if (!validHandle[0]) {
            return [false, "Invalid Handle"];
        }
        return [true];
    }

    static async isValidDuelRequest(players, problemCount, ratingMin, ratingMax, timeLimit) {
        let validHandle = await CodeforcesAPI.check_handle(players[0].handle);
        if (!validHandle[0]) {
            return [false, "Invalid Handle"];
        }
        let validProblemCount = problemCount && (problemCount >= 1 && problemCount <= 10);
        if (!validProblemCount) {
            return [false, "Invalid Problem Count"];
        }
        let validRatings = (ratingMin && ratingMax) && (ratingMin <= ratingMax) && (ratingMin >= 800 && ratingMax <= 3000);
        if (!validRatings) {
            return [false, "Invalid Ratings"];
        }
        let validTimeLimit = timeLimit && (timeLimit >= 10 && timeLimit <= 180);
        if (!validTimeLimit) {
            return [false, "Invalid Time Limit"];
        }
        return [true];
    }
    
}

export default DuelManager;