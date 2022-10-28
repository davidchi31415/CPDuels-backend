import mongoose, { mongo } from "mongoose";

const cfproblemSchema = mongoose.Schema({
	contestId: {
		type: Number,
		required: true,
	},
	index: {
		type: String,
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		required: true,
		default: "PROGRAMMING",
	},
	points: {
		type: Number,
	},
	tags: {
		type: [
			{
				type: String,
			},
		],
		required: false,
	},
	content: {
		type: {},
		required: true,
	},
});

const problemSchema = mongoose.Schema({
	contestId: {
		type: Number,
		required: true,
	},
	index: {
		type: String,
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		required: true,
		default: "PROGRAMMING",
	},
	points: {
		type: Number,
		required: true,
		default: 0,
	},
	tags: {
		type: [
			{
				type: String,
			},
		],
		required: false,
	},
	playerOneAttempts: {
		type: Number,
		required: true,
		default: 0,
	},
	playerTwoAttempts: {
		type: Number,
		required: true,
		default: 0,
	},
	playerOneScore: {
		type: Number,
		required: true,
		default: 0,
	},
	playerTwoScore: {
		type: Number,
		required: true,
		default: 0,
	},
});

const playerSchema = mongoose.Schema({
	handle: {
		type: String,
		required: true,
		default: "Guest",
	},
	uid: {
		type: String,
		required: true,
	},
});

const duelSchema = mongoose.Schema({
	platform: {
		type: String,
		required: true,
	},
	players: {
		type: [playerSchema],
		required: true,
		default: [],
	},
	problems: {
		type: [problemSchema],
		required: true,
		default: [],
	},
	ratingMin: {
		type: Number,
		required: true,
	},
	ratingMax: {
		type: Number,
		required: true,
	},
	problemCount: {
		type: Number,
		required: true,
		default: 5,
	},
	timeLimit: {
		type: Number,
		required: true,
		default: 30,
	},
	private: {
		type: Boolean,
		required: true,
		default: false,
	},
	status: {
		type: String,
		required: true,
		default: "WAITING", // READY, ONGOING, FINISHED
	},
	playerOneScore: {
		type: Number,
		required: true,
		default: 0,
	},
	playerTwoScore: {
		type: Number,
		required: true,
		default: 0,
	},
	playerOneSolves: {
		type: Number,
		required: true,
		default: 0,
	},
	playerTwoSolves: {
		type: Number,
		required: true,
		default: 0,
	},
	result: {
		type: [
			{
				type: String,
				required: true,
				default: "NONE", // DRAW, WON
			},
			{
				type: String, // Player handle of the winner
				required: false,
			},
		],
	},
	startTime: {
		type: Number,
	},
});

const submissionSchema = mongoose.Schema({
	platform: {
		type: String,
		required: true,
	},
	duelId: {
		type: String,
		required: true,
	},
	playerNum: {
		type: Number,
		required: true,
	},
	submissionsId: {
		type: String,
		required: true,
	},
	status: {
		type: String,
		required: true,
		default: "PENDING", // WA, AC, RTE
	},
});

export const cfproblemModel = mongoose.models.CFProblem
	? mongoose.model.CFProblem
	: mongoose.model("CFProblem", cfproblemSchema);
export const playerModel = mongoose.models.playerModel
	? mongoose.models.playerModel
	: mongoose.model("Player", playerSchema);
const duelModel = mongoose.models.duelModel
	? mongoose.models.duelModel
	: mongoose.model("Duel", duelSchema);
export const submissionModel = mongoose.models.submissionModel
	? mongoose.models.submissionModel
	: mongoose.model("Submission", submissionSchema);

export default duelModel;
