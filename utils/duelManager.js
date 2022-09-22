import db from "../server.js";
import io from './socket.js';
import { ObjectId } from "mongodb";

class DuelManager {
    constructor() {
        this.socket = io;
    }

    static async findProblems(filter={}, fields={}) {
        // filter for the problems we're looking for
        // fields for the parts of the problems
        let result = await db.collection('problems').find(filter, fields).toArray();
        return result;
    }

    static async getDuelState(id) {
        let duels = await db.collection('duels').find({
            _id: ObjectId(id)
        }, {}).toArray();
        if (duels.length != 0 ) return duels[0].status;
        return -1;
    }

    static async changeDuelState(id, state) {
        console.log('runing');
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
}

export default DuelManager;