import superagent from "superagent";
import { sleep } from "../helpers/sleep.js";
import fetch from "node-fetch";
import ql from "superagent-graphql";
import db from "../../server.js";
class LeetcodeAPI {
	//https://leetcode.com/api/problems/all/

	static async getAPIResponse(url, params) {
		try {
			let tries = 0;
			let returnObj;
			while (tries < 5) {
				tries++;
				let responseData = {
					status: "",
					comment: "",
				};
				await fetch(url, params).then(async (res) => {
					if (res.status === 503) {
						// Limit exceeded error
						responseData.status = "FAILED";
						responseData.comment = "limit exceeded";
						await sleep(1000);
					} else {
						responseData = await res.json();
					}
				});
				if (responseData?.status === "OK") return responseData;
				returnObj = responseData;
			}
			return returnObj; // Return if fail after 5 tries and not limit exceeded
		} catch (e) {
			console.log(e);
			return false;
		}
	}

	async getProblem(titleSlug) {
		let queryString = `
		query questionData($titleSlug: String!) {
			question(titleSlug: $titleSlug) {
			  questionId
			  questionFrontendId
			  boundTopicId
			  title
			  titleSlug
			  content
			  translatedTitle
			  translatedContent
			  isPaidOnly
			  difficulty
			  likes
			  dislikes
			  isLiked
			  similarQuestions
			  exampleTestcases
			  contributors {
				username
				profileUrl
				avatarUrl
			  }
			  topicTags {
				name
				slug
				translatedName
			  }
			  companyTagStats
			  codeSnippets {
				lang
				langSlug
				code
			  }
			  stats
			  hints
			  solution {
				id
				canSeeDetail
				paidOnly
				hasVideoSolution
				paidOnlyVideo
			  }
			  status
			  sampleTestCase
			  metaData
			  judgerAvailable
			  judgeType
			  mysqlSchemas
			  enableRunCode
			  enableTestMode
			  enableDebugger
			  envInfo
			  libraryUrl
			  adminUrl
			  challengeQuestion {
				id
				date
				incompleteChallengeCount
				streakCount
				type
			  }
			  note
			  __typename
			}
		  }`;

		let queryVars = {
			titleSlug: titleSlug,
		};

		let res = await superagent
			.get("https://leetcode.com/graphql")
			// .set(
			// 	"Cookie",
			// 	"csrf=liEwfqNngFMKxnjAzSK6cYA6gYYUmCn6HQcRkhx5no37xqVjQG8OfXF76LE3hUob"
			// )
			.use(ql(queryString, queryVars));
		return JSON.parse(res.text).data;
	}

	async getProblemList() {
		const url = "https://leetcode.com/api/problems/all/";
		// const response = await LeetcodeAPI.getAPIResponse(url);
		const response = JSON.parse((await superagent.get(url)).text);
		if (!response) {
			return false;
		}
		return response["stat_status_pairs"];
	}

	mapDifficulty(difficultyNum) {
		if (difficultyNum === 1) return "EASY";
		else if (difficultyNum === 2) return "MEDIUM";
		else return "HARD";
	}

	async updateProblemsInDatabase() {
		console.log("Updating LC Problemset: Fetching From Leetcode");
		let list = await this.getProblemList();
		let filteredProblems = list
			.filter((problem) => !problem.paid_only)
			.map((problem) => {
				return {
					title: problem.stat.question__title,
					slug: problem.stat.question__title_slug,
					difficulty: this.mapDifficulty(problem.difficulty.level),
				};
			}); // Get only the unpaid problems and project their title, slug, and difficulty
		console.log(filteredProblems);
		let scraped_problems = [];
		for (let i = 0; i < filteredProblems.length; i++) {
			let res = await this.getProblem(filteredProblems[i].slug);
			let problemData = res.question;
			scraped_problems.push({
				...filteredProblems[i],
				content: problemData.content,
				exampleTestCases: problemData.exampleTestcases,
				codeSnippets: problemData.codeSnippets,
				hints: problemData.hints,
				sampleTestCase: problemData.sampleTestCase,
				likesDislikes: [problemData.likes, problemData.dislikes],
			});
			console.log(
				`Updating LC Problemset: ${i + 1}/${filteredProblems.length}`
			);
		}
		await db.collection("lcproblems").insertMany(scraped_problems);
		console.log(scraped_problems);
		console.log("LC Problemset successfully updated.");
	}
	async testing() {
		let paidlevels = [0, 0, 0];
		let freelevels = [0, 0, 0];
		let prevTime = Date.now();
		let problems = await this.getProblemList();
		console.log(Date.now() - prevTime);
		// console.log(typeof problems);
		problems.forEach((problem) => {
			if (problem.paid_only) {
				paidlevels[problem.difficulty.level - 1]++;
			} else {
				freelevels[problem.difficulty.level - 1]++;
			}
			if (problem.status != null) {
				console.log(problem.status);
			}
		});
		console.log(paidlevels);
		console.log(freelevels);
	}
}

export default LeetcodeAPI;
