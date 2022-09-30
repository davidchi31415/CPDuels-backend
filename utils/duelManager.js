import db from "../server.js";
import CodeforcesAPI from "./codeforcesAPI.js";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import TaskManager from "./taskManager.js";


class DuelManager {
    static async findProblems(filter={}, fields={}) {
        // filter for the problems we're looking for
        // fields for the parts of the problems
        
        let result = await db.collection('problems').find(filter, fields).toArray();

        return result;
    }

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
        let handles = [duel.players[0].handle, duel.players[1].handle]
        let problems = await TaskManager.getDuelProblems(duel.problemCount, handles, duel.ratingMin, duel.ratingMax);
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

    static async isUserSubmissionOK(handle, contestId, index, name) {
        let submissions = await CodeforcesAPI.get_user_submissions(handle);
        var filteredSubmissions;
        if (submissions.length != 0) {
            filteredSubmissions = submissions.filter(function (sub) {
                return sub.contestId == contestId &&
                       sub.index == index &&
                       sub.verdict == 'OK'
            });
        }
        console.log(filteredSubmissions);
        if (filteredSubmissions.length != 0) {
            return true;
        }
        return false;
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

    static async isValidDuelRequest(handle, problemCount, ratingMin, ratingMax, timeLimit) {
        let validHandle = await CodeforcesAPI.check_handle(handle);
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