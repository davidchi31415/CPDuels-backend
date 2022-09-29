import CodeforcesAPI from "./codeforcesAPI.js";
<<<<<<< HEAD
import db from "../server.js";

class taskManager {
=======
import DuelManager from "./duelManager.js";
import db from "../server.js";

class TaskManager {
>>>>>>> 2af80d563b7f9ef33fdea60107ffdc03284c8f3d
    static async update_problemset() {
        let problem_list = await CodeforcesAPI.get_problem_list();
        db.collection('problems').insertMany(problem_list);
    }

<<<<<<< HEAD
}
export default taskManager;
=======
    static async filterProblems(ratingMin, ratingMax) {
        //{rating: {$gt:ratingMin, $lt:ratingMax}}
        let result = await DuelManager.findProblems({rating: {$gte:ratingMin, $lte:ratingMax}});
        return result;
    }

}
export default TaskManager;
>>>>>>> 2af80d563b7f9ef33fdea60107ffdc03284c8f3d
