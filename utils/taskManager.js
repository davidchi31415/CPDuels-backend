import CodeforcesAPI from "./codeforcesAPI.js";
import DuelManager from "./duelManager.js";
import db from "../server.js";

class TaskManager {
    static async update_problemset() {
        let problem_list = await CodeforcesAPI.get_problem_list();
        db.collection('problems').insertMany(problem_list);
    }

    static async filterProblemsbyRating(ratingMin, ratingMax) {
        //{rating: {$gt:ratingMin, $lt:ratingMax}}
        let result = await DuelManager.findProblems({rating: {$gte:ratingMin, $lte:ratingMax}});
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

}
export default TaskManager;
