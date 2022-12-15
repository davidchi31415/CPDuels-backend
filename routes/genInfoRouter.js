import express from "express";
import duelModel from "../models/models.js";
import DuelManager from "../managers/DuelManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import db from "../server.js";

const genInfoRouter = express.Router();

// GET all duels
genInfoRouter.get("/playercurrentduels/:uid", async (req, res) => {
	try {
        let uid = req.params.uid;
        let duels = await DuelManager.isPlayerInDuel(uid);
        res.send({ currentDuels: duels});
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

export default genInfoRouter;
