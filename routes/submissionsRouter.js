import express from "express";
import { submissionModel } from "../models/models.js";

const submissionsRouter = express.Router();

// GET all submissions
submissionsRouter.get("/", async (req, res) => {
	try {
		const submissions = await submissionModel.find();
		res.send(submissions);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// GET one submission
submissionsRouter.get("/:id", getSubmission, (req, res) => {
	res.send(res.submission);
});

// DELETE one submission
submissionsRouter.delete("/:id", getSubmission, async (req, res) => {
	try {
		await res.submission.delete();
		res.json({ message: "Submission deleted." });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// DELETE all submissions
submissionsRouter.delete("/", async (req, res) => {
	try {
		await submissionModel.deleteMany();
		res.json({ message: "All submissions deleted." });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

async function getSubmission(req, res, next) {
	let submission;
	try {
		submission = await submissionModel.findById(req.params.id);
		// Check for error and immediately return to avoid setting res.subscriber
		if (submission == null)
			return res.status(404).json({ message: "Submission not found." });
	} catch (err) {
		// Immediately return in case of error to avoid setting res.subscriber
		return res.status(500).json({ message: err.message });
	}

	res.submission = submission;
	next();
}

export default submissionsRouter;
