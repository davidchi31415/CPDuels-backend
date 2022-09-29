import CodeforcesAPI from "./codeforcesAPI.js";
import db from "../server.js";

class taskManager {
    static async update_problemset() {
        let problem_list = await CodeforcesAPI.get_problem_list();
        db.collection('problems').insertMany(problem_list);
    }

}
export default taskManager;