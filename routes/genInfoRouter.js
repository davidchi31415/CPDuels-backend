import express from "express";
import duelModel, { submissionModel } from "../models/models.js";
import DuelManager from "../managers/DuelManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import db from "../server.js";

const genInfoRouter = express.Router();

// GET all current (active) duels by uid
genInfoRouter.get("/playercurrentduels/:uid", async (req, res) => {
	try {
        let uid = req.params.uid;
        let duels = await DuelManager.isPlayerInDuel(uid);
        res.send({ currentDuels: duels});
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// GET all submissions by duelId and uid
genInfoRouter.get("/playerduelsubmissions/:id/", async (req, res) => {
	try {
		let id = req.params.id;
		let submissions = await db.collection("submissions").find({ duelId: id }).toArray();
		if (submissions?.length) {
			res.send({ submissions: submissions });
		} else {
	        res.send({ submissions: []});
		}
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// GET all submissions by duelId and uid
genInfoRouter.get("/playerduelsubmissions/:id/:uid", async (req, res) => {
	try {
		let id = req.params.id;
        let uid = req.params.uid;
		let submissions = await db.collection("submissions").find({ duelId: id, uid: uid }).toArray();
		if (submissions?.length) {
			res.send({ submissions: submissions });
		} else {
	        res.send({ submissions: []});
		}
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

export default genInfoRouter;
