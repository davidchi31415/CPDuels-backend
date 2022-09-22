import CodeforcesAPI from "./cf_api.js";
import db from "../server.js";

async function find_problems(filter={}, fields={}) {
    // filter for the problems we're looking for
    // fields for the parts of the problems
    let result = await db.collection('problems').find(filter, fields).toArray();
    return result;
}

export default find_problems;