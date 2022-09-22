import db from "../server.js";
import io from './socket.js';

class DuelManager {
    constructor() {
        this.socket = io;
    }

    static async find_problems(filter={}, fields={}) {
        // filter for the problems we're looking for
        // fields for the parts of the problems
        let result = await db.collection('problems').find(filter, fields).toArray();
        return result;
    }
}

export default DuelManager;