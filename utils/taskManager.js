import CodeforcesAPI from "./codeforcesAPI.js";
import DuelManager from "./duelManager.js";
import db from "../server.js";

class TaskManager {
    static async update_problemset() {
        let problem_list = await CodeforcesAPI.get_problem_list();
        console.log(problem_list);
        db.collection('cfproblems').insertMany(problem_list);
    }

    static async findCFProblems(filter={}, fields={}) {
        // filter for the problems we're looking for
        // fields for the parts of the problems
        
        let result = await db.collection('cfproblems').find(filter, fields).toArray();

        return result;
    }

    static async filterProblemsbyRating(ratingMin, ratingMax) {
        //{rating: {$gt:ratingMin, $lt:ratingMax}}
        let result = await this.findCFProblems({rating: {$gte:ratingMin, $lte:ratingMax}});
        return result;
    }

    static async filterProblemsbyHandlesAndRating(handles,ratingMin,ratingMax) {
        let ratedProblems = await this.filterProblemsbyRating(ratingMin,ratingMax);
        let submissions1 = await CodeforcesAPI.get_user_submissions(handles[0]);
        let submissions2 = await CodeforcesAPI.get_user_submissions(handles[1]);
        let combined_submissions = submissions1.concat(submissions2.filter((item) => submissions1.indexOf(item) < 0));

        //contestId index 
        let filteredProblems = ratedProblems;
        if (combined_submissions.length != 0) {
            filteredProblems = ratedProblems.filter((problem) => {
                return !(combined_submissions.some((f) => {
                  return f.contestId === problem.contestId && f.index === problem.index;
                }));
            });
        }
        return filteredProblems;
    }

    static async getDuelProblems(numProblems,handles,ratingMin,ratingMax) {
        let problems = await this.filterProblemsbyHandlesAndRating(handles,ratingMin,ratingMax);
        let problemSet = problems.sort(() => 0.5 - Math.random());
        return problemSet.slice(0,numProblems);
    }

    static async getUserSolves(id, handle, contestId, index, exclude=0) {
        let submissions = await CodeforcesAPI.get_user_submissions(handle);
        let duel = await DuelManager.findDuel(id);
        if (submissions) {
            let filteredSubmissions = submissions.slice(0, submissions.length-exclude).filter(function (submission) {
                return submission.contestId === contestId &&
                       submission.index === index &&
                       submission.creationTimeSeconds > duel.startTime
            });
            console.log(filteredSubmissions);
            return filteredSubmissions.reverse();
        }
        return [];
    }

}
export default TaskManager;
