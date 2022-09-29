import CodeforcesAPI from "./codeforcesAPI.js";
import DuelManager from "./duelManager.js";
import db from "../server.js";

class TaskManager {
    static async update_problemset() {
        let problem_list = await CodeforcesAPI.get_problem_list();
        db.collection('problems').insertMany(problem_list);
    }

    static async filterProblems(ratingMin, ratingMax) {
        //{rating: {$gt:ratingMin, $lt:ratingMax}}
        let result = await DuelManager.findProblems({rating: {$gte:ratingMin, $lte:ratingMax}});
        return result;
    }

}
export default TaskManager;
