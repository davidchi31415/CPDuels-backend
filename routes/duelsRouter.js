import express from "express";
import duelModel from "../models/models.js";
import DuelManager from "../managers/DuelManager.js";
import CodeforcesAPI from "../utils/api/CodeforcesAPI.js";
import db from "../server.js";

const duelsRouter = express.Router();

// GET all duels
duelsRouter.get("/", async (req, res) => {
	try {
		let time = Date.now();
		const duels = await duelModel.find().lean();
		console.log(Date.now() - time);
		res.send(duels);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// GET one duel
duelsRouter.get("/:id", getDuel, (req, res) => {
	res.send(res.duel);
});

// POST one duel
duelsRouter.post("/add", async (req, res) => {
	let numDuels = await duelModel.countDocuments()
	let joinStatus = await DuelManager.isPlayerInDuel(req.body.players[0].uid);
	if (joinStatus.length) {
		res.status(400).json({ message: "Already in a duel!", url: joinStatus[0] });
	} else if (numDuels >= 50) {
		res.status(400).json({ message: "Too many duels. We bouta loose all our minutes on railways :(", url: joinStatus[0] });
	}else {
		const duel = new duelModel(req.body);
		console.log(req.body);
		let validDuel = await DuelManager.isValidDuelRequest(
			req.body.platform,
			req.body.players,
			req.body.problemCount,
			req.body.ratingMin,
			req.body.ratingMax,
			req.body.timeLimit
		);
		console.log(validDuel);
		try {
			if (validDuel[0]) {
				const newDuel = await duel.save();
				res.status(201).json(newDuel);
			} else {
				res.status(400).json({ message: validDuel[1] });
			}
		} catch (err) {
			res.status(400).json({ message: err.message });
		}
	}
});

// PATCH one duel
duelsRouter.patch("/:id", getDuel, async (req, res) => {
	if (req.body.status != null) {
		res.duel.status = req.body.status;
	}
	try {
		const updatedDuel = await res.duel.save();
		res.json(updatedDuel);
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

// DELETE one duel
duelsRouter.delete("/:id", getDuel, async (req, res) => {
	try {
		await res.duel.delete();
		res.json({ message: "Duel deleted." });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// DELETE all duels
duelsRouter.delete("/", async (req, res) => {
	try {
		await duelModel.deleteMany();
		res.json({ message: "All duels deleted." });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

async function getDuel(req, res, next) {
	let duel;
	try {
		duel = await duelModel.findById(req.params.id);
		// Check for error and immediately return to avoid setting res.subscriber
		if (duel == null)
			return res.status(404).json({ message: "Duel not found." });
	} catch (err) {
		// Immediately return in case of error to avoid setting res.subscriber
		return res.status(500).json({ message: err.message });
	}

	res.duel = duel;
	next();
}

export default duelsRouter;
