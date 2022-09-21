import CodeforcesAPI from "./cf_api.js";
import db from "../server.js";

async function update_problemset() {
    
    let problem_list = await CodeforcesAPI.get_problem_list();
    // for (var i = 0; i < problem_list.length; i++) {
    //     console.log(problem_list[i]);
    // }
    // let asdf = problem_list[0];
    // console.log(asdf);
    db.collection('problems').insertMany(problem_list);
}

export default update_problemset;
