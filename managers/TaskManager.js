import Queue from "../utils/helpers/queue.js";

class TaskManager {
	constructor(codeforcesAPI) {
		this.queue = new Queue();
		this.codeforcesAPI = codeforcesAPI;
	}
	async init() {
		const checker = async function () {
			console.log(this.queue);
			if (this.queue.size()) {
				let obj = this.queue.dequeue();
				if (obj[0] == "submit") {
					await submitProblem(
						obj[1].duel,
						obj[1].uid,
						obj[1].submission
					);
				}
			}
		};
		setInterval(checker.bind(this), 5000);
	}

	async updateProblemsets() {
		await this.codeforcesAPI.updateProblemsInDatabase();
		// await this.atcoderAPI.updateProblemsInDatabase();
		// await this.leetcodeAPI.updateProblemsInDatabase();
	}

	/*
   async isValidSubmitRequest(duel, uid, submission) {}
  */

	async createDuelProblems(duel) {
		let usernames = [duel.players[0].username, duel.players[1].username];
		let problems;
		if (duel.platform === "CF") {
			problems = await this.codeforcesAPI.generateProblems(
				duel.problemCount,
				usernames,
				duel.ratingMin,
				duel.ratingMax
			);
		} else if (platform === "AT") {
			// problems = await AtcoderAPI.generateProblems(duel.problemCount, usernames, duel.ratingMin, duel.ratingMax);
		} else if (platform === "LC") {
			// problems = await LeetcodeAPI.generateProblems(duel.problemCount, usernames, duel.ratingMin, duel.ratingMax);
		} else {
			// Error
		}
		return problems;
	}

	async taskSubmit(duel, uid, submission) {
		this.queue.enqueue([
			"submit",
			{
				duel: duel,
				uid: uid,
				submission: submission,
			},
		]);
	}

	async submitProblem(duel, uid, submission) {
		let problem = duel.problems[submission.number - 1];
		if (duel.platform === "CF") {
			await this.codeforcesAPI.login();
			await this.codeforcesAPI.submitProblem(
				problem.contestId,
				problem.index,
				submission.content
			);
		} else if (duel.platform === "AT") {
			// await AtcoderAPI.login();
			// await AtcoderAPI.submitProblem(problem.contestId, problem.index, submission.content);
		} else {
			// await LeetcodeAPI.login();
			//await LeetcodeAPI.submitProblem(problem.contestId, problem.index, submission.content);
		}
	}

	async getUserSolves(duel, username) {
		let filteredSubmissions =
			await this.codeforcesAPI.getUserSubmissionsAfterTime(
				username,
				duel.startTime
			);
		if (filteredSubmissions) {
			console.log(filteredSubmissions);
			return filteredSubmissions.reverse();
		}
		return [];
	}
}

export default TaskManager;
