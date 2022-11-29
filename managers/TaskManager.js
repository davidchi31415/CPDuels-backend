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
					await this.submitProblem(
						obj[1].duel,
						obj[1].uid,
						obj[1].submission
					);
				}
			}
		};

		setInterval(checker.bind(this), 1000);
		// while (true) {
		// 	await this.codeforcesAPI.updateSubmissions();
		// }
	}

	async updateProblemsets() {
		await this.codeforcesAPI.updateProblemsInDatabase();
		// await this.atcoderAPI.updateProblemsInDatabase();
		// await this.leetcodeAPI.updateProblemsInDatabase();
	}

	/*
   async isValidSubmitRequest(duel, uid, submission) {}
  */

	calculateProblemPoints(platform, problemRating, duelRatingMin) {
		if (platform === "CF") {
			// base is 500 points, add however many points over the rating min of duel
			return problemRating - duelRatingMin + 500;
		} else if (platform === "AT") {
		} else {
			// Leetcode
		}
	}

	async createDuelProblems(duel) {
		let usernames = [duel.players[0].username, duel.players[1].username];
		let guestStatuses = [duel.players[0].guest, duel.players[1].guest];
		let problems;
		if (duel.platform === "CF") {
			problems = await this.codeforcesAPI.generateProblems(
				duel.problemCount,
				usernames,
				guestStatuses,
				duel.ratingMin,
				duel.ratingMax
			);
			for (let i = 0; i < problems.length; i++) {
				problems[i] = {
					...problems[i],
					duelPoints: this.calculateProblemPoints(
						duel.platform,
						problems[i].rating,
						duel.ratingMin
					),
				};
			}
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
		// submission: {
		// 	languageCode: chosenLanguage,
		// 	number: problemNum,
		// 	content: fileContent.current,
		//   },
		console.log(submission);
		let problem = duel.problems[submission.number - 1];
		if (duel.platform === "CF") {
			await this.codeforcesAPI.login();
			this.codeforcesAPI.submitProblem(
				problem.contestId,
				problem.index,
				submission.content,
				submission.languageCode,
				duel._id,
				uid
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
