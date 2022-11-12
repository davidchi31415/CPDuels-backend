import fetch from "node-fetch";
import { sleep } from "../helpers/sleep.js";
import cheerio from "cheerio";
import db from "../../server.js";
import superagent from "superagent";
import { findCsrf } from "../helpers/findCsrf.js";
import circularArray from "../helpers/circularArray.js";
import { ObjectId } from "mongodb";

class CodeforcesAPI {
	constructor() {
		this.client = superagent.agent();
		this.loginInfo = new circularArray([
			["cpduels-bot", "davidandjeffrey"],
			["cpduels-bot", "davidandjeffrey"],
			["cpduels-bot", "davidandjeffrey"],
		]);
	}

	/////////////////////////////////////////////////////////////////////////////////
	// API

	async getAPIResponse(url, params) {
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

	async post(data) {
		return await this.client
			.post(data[0])
			.send(data[1])
			.set("Content-Type", "application/x-www-form-urlencoded");
	}

	async updateProblemsInDatabase() {
		console.log("Updating CF Problemset: fetching CF Problems");
		let problem_list = await this.getProblemList();
		console.log("Updating CF Problemset: scraping CF Problems");
		let scraped_problems = [];
		for (let i = 0; i < 100; i++) {
			let interactive = false;
			for (let j = 0; j < problem_list[i].tags?.length; j++) {
				if (problem_list[i].tags[j] === "interactive")
					interactive = true; // TO DO
			}
			if (interactive) continue;
			let content = await this.getProblemContent(
				problem_list[i].contestId,
				problem_list[i].index
			);
			if (!content) continue; // if problem was not properly scraped
			scraped_problems.push({ ...problem_list[i], content: content });
			console.log(
				`Updating CF Problemset: scraped ${i + 1}/${
					problem_list.length
				}`
			);
		}
		db.collection("cfproblems").insertMany(scraped_problems);
		console.log(scraped_problems);
		console.log("CF Problemset successfully updated.");
	}

	async login() {
		try {
			let resp = await this.client.get("https://codeforces.com/enter/");
			console.log(resp.status);
			let login = this.loginInfo.getCurAndUpdate();
			let csrf = findCsrf(resp.text);
			let res = await this.client
				.post("https://codeforces.com/enter/")
				.send({
					_tta: "176",
					csrf_token: csrf,
					action: "enter",
					handleOrEmail: login[0],
					password: login[1],
				})
				.set("Content-Type", "application/x-www-form-urlencoded");
			console.log(res.status);
			let re = /cpduels-bot/gs;
			if (!(await res.text.match(re))) {
				throw "Request failed. Check handleOrEmail or password";
			}
			console.log("Login Succeeded");
		} catch (err) {
			console.log("codeforces might be down");
			console.log(`Login failed: \n ${err}`);
		}
	}
	toComment(programTypeId, text) {
		if (
			[
				43,
				80,
				52,
				50,
				54,
				73,
				59,
				61, // C++
				65,
				79,
				9, // C#
				28, // D
				32, // Go
				60,
				74,
				36, // Java
				48,
				72,
				77, //Kotlin
				3, // Delphi 7
				4,
				51, //Pascal
				6, // PHP
				75, // Rust
				20, // Scala
				34,
				55, // Javascript
			].includes(programTypeId)
		) {
			return `// ${text}`;
		}

		if (
			[
				13, // Perl #
				7,
				31,
				40,
				41,
				70, // Python #
				67, // Ruby #
			].includes(programTypeId)
		) {
			return `# ${text}`;
		}

		if (programTypeId === 12) {
			// Haskell --
			return `-- ${text}`;
		}

		if (programTypeId === 19) {
			// Ocaml ['(*','*)']
			return `(* ${text} *)`;
		}
	}

	//https://codeforces.com/contest/1729/submission/177820677

	async getPendingSubmissionsFromDatabase() {
		let result = await db
			.collection("submissions")
			.find(
				{
					status: "PENDING",
				},
				{}
			)
			.toArray();
		return result;
	}

	async updateSubmissions() {
		let dbSubmissions = await this.getPendingSubmissionsFromDatabase();
		if (!dbSubmissions.length) {
			console.log("there are no sumissions to update :)");
			return;
		}
		let submissions = await this.getUserSubmissions("cpduels-bot");
		let submissionCounter = dbSubmissions.length;
		for (let i = 0; i < submissions.length; i++) {
			if (submissionCounter === 0) break; // If there are no PENDING submissions, don't check
			let submission = submissions[i];
			let duelId, uid;
			let info = await this.getSubmissionUserInfo(submission);
			console.log("Found info");
			console.log(info);
			let verdict = submission.verdict ? submission.verdict : "PENDING";
			if (verdict === "TESTING") continue;
			if (info) {
				({ duelId, uid } = info);
				let findSubmission = await db
					.collection("submissions")
					.find(
						{
							duelId: ObjectId(duelId),
							uid: uid,
						},
						{}
					)
					.toArray();
				console.log(findSubmission);
				if (findSubmission.length != 0) {
					console.log("Found summission in database");
					// update submission
					if (findSubmission[0].status !== "PENDING") continue; // Only update if it is a pending submission
					await db.collection("submissions").findOneAndUpdate(
						{
							duelId: ObjectId(duelId),
							uid: uid,
						},
						{
							$set: {
								status: verdict,
								submissionId: submission.id,
							},
						}
					);
					submissionCounter--; // Mark off the submission (from pending submissions we were looking for)
					console.log(
						`Updated player ${uid}'s submission with id ${submission.id} in duel ${duelId} to ${submission.verdict}`
					);
				} else {
					console.log(
						`No player/duel info on submission ${submission.id}`
					);
				}
			} else {
				console.log(
					`Submission ${submission.id} has invalid info ${info}`
				);
			}
		}
	}

	async getSubmissionUserInfo(submission) {
		let source = await this.getSubmissionSource(
			submission.contestId,
			submission.id
		);
		try {
			return await this.getSubmissionInfoFromSource(source);
		} catch {
			return 0;
		}
	}

	async getSubmissionSource(contestId, id) {
		let url = `https://codeforces.com/contest/${contestId}/submission/${id}`;
		let res;
		while (!res || res.status != 200) {
			try {
				res = await this.client.get(url);
			} catch {}
		}

		const $ = cheerio.load(res.text);
		return $('pre[id="program-source-text"]').text();
	}

	getSubmissionInfoFromSource(text) {
		let comment = text.split(/\r?\n|\r|\n/g)[0];
		let totalResult = comment.match(/[a-z0-9-]*/gs).filter((e) => {
			return e !== "";
		})[0];
		console.log(totalResult);
		return {
			duelId: totalResult.slice(0, 24),
			uid: totalResult.slice(24),
		};
	}

	async submitProblem(
		contestId,
		problemIndex,
		sourceCode,
		programTypeId,
		duelId,
		uid
	) {
		try {
			sourceCode = `${this.toComment(
				programTypeId,
				`${duelId}${uid}`
			)}\n${sourceCode}`;
			console.log(sourceCode);
			let resp = await this.client.get(
				`https://codeforces.com/contest/${contestId}/submit`
			);
			let csrf = await findCsrf(resp.text);
			let submitUrl = `https://codeforces.com/contest/${contestId}/submit?csrf_token=${csrf}`;
			let res = await this.post([
				submitUrl,
				{
					csrf_token: csrf,
					action: "submitSolutionFormSubmitted",
					submittedProblemIndex: problemIndex,
					programTypeId: programTypeId,
					contestId: contestId,
					source: sourceCode,
					tabSize: "4",
					_tta: "594",
					sourceCodeConfirmed: "true",
				},
			]);

			const $ = cheerio.load(res.text);
			const error = $('span[class="error for__source"]').text();
			if (error !== "") throw error;
			else {
				let timeSubmitted = new Date().toLocaleString() + " CT";
				await db.collection("submissions").insertOne({
					platform: "CF",
					timeSubmitted: timeSubmitted,
					duelId: duelId,
					uid: uid,
					status: "PENDING",
				});

				console.log(
					`Submitted solution for ${contestId}${problemIndex}`
				);
			}
		} catch (err) {
			console.log(
				`Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`
			);
		}
	}

	async checkUsername(username) {
		const url = `https://codeforces.com/api/user.info?handle=${username}`;
		const response = await this.getAPIResponse(url);
		if (!response) {
			return [false, "Codeforces API Error"];
		}
		if (response.status === "FAILED") {
			return [false, response.comment];
		}
		return [true, response.result[0]];
	}

	async checkDuelParams(username, ratingMin, ratingMax) {
		// For validating duel creation request
		let validUsername = await this.checkUsername(username);
		if (!validUsername) {
			return [false, "Inavlid CF Username"];
		}
		let validRatings =
			ratingMin &&
			ratingMax &&
			ratingMin <= ratingMax &&
			ratingMin >= 800 &&
			ratingMax <= 3000;
		if (!validRatings) {
			return [false, "Invalid CF Ratings"];
		}
		return [true, "good"];
	}

	async getUserSubmissions(username) {
		const url = `https://codeforces.com/api/user.status?handle=${username}`;
		console.log(url);
		const response = await this.getAPIResponse(url);
		if (!response) return [false, "CF API Error"];
		if (response.status !== "OK") return [false, response.comment];
		let data = [];
		try {
			response.result.forEach((submission) => {
				let problem = submission.problem;
				if (!problem.hasOwnProperty("rating")) return;
				if (!submission.hasOwnProperty("verdict"))
					submission.verdict = null;
				data.push({
					id: submission.id,
					contestId: problem.contestId,
					index: problem.index,
					name: problem.name,
					type: problem.type,
					rating: problem.rating,
					creationTimeSeconds: submission.creationTimeSeconds,
					verdict: submission.verdict,
				});
			});
		} catch (e) {
			console.log("Getting User Submissions FAILED");
		}
		return data;
	}

	async getUserSubmissionsAfterTime(username, time) {
		const url = `https://codeforces.com/api/user.status?handle=${username}`;
		console.log(url);
		let time1 = Date.now();
		const response = await this.getAPIResponse(url);
		console.log(time1 - Date.now());
		if (!response) return [false, "CF API Error"];
		if (response.status !== "OK") return [false, response.comment];
		let data = [];
		try {
			let time2 = Date.now();
			for (let i = 0; i < response.result.length; i++) {
				let submission = response.result[i];
				if (submission.creationTimeSeconds < time) break;
				if (!submission.hasOwnProperty("verdict"))
					submission.verdict = null;
				let problem = submission.problem;
				data.push({
					contestId: problem.contestId,
					index: problem.index,
					name: problem.name,
					type: problem.type,
					rating: problem.rating,
					creationTimeSeconds: submission.creationTimeSeconds,
					verdict: submission.verdict,
				});
			}
			console.log(Date.now() - time2);
		} catch (e) {
			console.log("Getting User Submissions FAILED: " + e);
		}
		return data;
	}

	async getContestList() {
		const url = "https://codeforces.com/api/contest.list";
		const response = await this.getAPIResponse(url);
		if (!response) {
			return false;
		}
		return response["result"];
	}

	async getProblemList() {
		const url = "https://codeforces.com/api/problemset.problems";
		const response = await this.getAPIResponse(url);
		if (!response) {
			return false;
		}
		return response["result"]["problems"];
	}

	async getProblems(filter = {}, fields = {}) {
		// filter for the problems we're looking for
		// fields for the parts of the problems

		let result = await db
			.collection("cfproblems")
			.find(filter, fields)
			.toArray();

		return result;
	}

	async getProblemsByUsernamesAndRating(usernames, ratingMin, ratingMax) {
		let ratedProblems = await this.getProblems({
			rating: { $gte: ratingMin, $lte: ratingMax },
		});
		let submissions1 = await this.getUserSubmissions(usernames[0]);
		let submissions2 = await this.getUserSubmissions(usernames[1]);
		let combined_submissions = submissions1.concat(
			submissions2.filter((item) => submissions1.indexOf(item) < 0)
		);

		//contestId index
		let filteredProblems = ratedProblems;
		if (combined_submissions.length != 0) {
			filteredProblems = ratedProblems.filter((problem) => {
				return !combined_submissions.some((f) => {
					return (
						f.contestId === problem.contestId &&
						f.index === problem.index
					);
				});
			});
		}
		return filteredProblems;
	}

	async generateProblems(numProblems, usernames, ratingMin, ratingMax) {
		let problems = await this.getProblemsByUsernamesAndRating(
			usernames,
			ratingMin,
			ratingMax
		);
		let problemSet = problems.sort(() => 0.5 - Math.random());
		return problemSet.slice(0, numProblems);
	}

	////////////////////////////////////////////////////////////////////////////////////////
	// Scraper

	async findProblemConstraints(body, contestId, index) {
		let re = /<div class="time-limit">([\s\S]*?)<p>/;
		try {
			let raw = body.match(re)[0];
			return raw.substring(0, raw.length - 3);
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} constraints: ` + e
			);
		}
	}

	async findProblemStatement(body, contestId, index) {
		let re1 =
			/<div class="problem-statement">([\s\S]*?)<div class="input-specification">/;
		try {
			let totalProblemStatement = body.match(re1)[0];
			let re2 = /<p>(.*?)<\/div><div class="input-specification">/;
			let problemStatement = totalProblemStatement.match(re2)[1];
			problemStatement = problemStatement.replace(
				/\$\$\$\$\$\$(.*?)\$\$\$\$\$\$/g,
				"\\[$1\\]"
			);
			problemStatement = problemStatement.replace(
				/\$\$\$(.*?)\$\$\$/g,
				"\\($1\\)"
			);
			return problemStatement;
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} statement: ` + e
			);
		}
	}

	async findProblemInput(body, contestId, index) {
		let re =
			/<div class="input-specification"><div class="section-title">Input<\/div>([\s\S]*?)<\/div><div class="output-specification">/;
		try {
			return body.match(re)[1];
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} input: ` + e
			);
		}
	}

	async findProblemOutput(body, contestId, index) {
		let re =
			/<div class="output-specification"><div class="section-title">Output<\/div>([\s\S]*?)<\/div><div class="sample-tests">/;
		try {
			return body.match(re)[1];
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} input: ` + e
			);
		}
	}

	async findProblemTestCases(body, contestId, index) {
		let re = /<div class="sample-tests">([\s\S]*?)<\/div><\/div><\/div>/;
		try {
			return body.match(re)[0];
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} test cases: ` + e
			);
		}
	}

	async findProblemNote(body, contestId, index) {
		let re = /<div class="note">([\s\S]*?)<\/p><\/div>/;
		try {
			return body.match(re)[0];
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} note: It probably doesn't have one.`
			);
		}
	}

	async getProblemContent(contestId, index) {
		const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		let resp;
		try {
			resp = await this.client.get(
				`https://codeforces.com/problemset/problem/${contestId}/${index}`
			);
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index}, will retry: ` + e
			);
		}
		while (!resp || !resp.ok) {
			await sleep(100);
			try {
				resp = await this.client.get(
					`https://codeforces.com/problemset/problem/${contestId}/${index}`
				);
			} catch (e) {
				console.log(
					`Couldn't fetch problem ${contestId}${index}, will retry: ` +
						e
				);
			}
		}
		try {
			// translate Codeforces's inline and display equation delimiters to something MathJax understands
			let texFilteredResp = resp.text.replace(
				/\$\$\$\$\$\$(.*?)\$\$\$\$\$\$/g,
				"\\[$1\\]"
			);
			texFilteredResp = texFilteredResp.replace(
				/\$\$\$(.*?)\$\$\$/g,
				"\\($1\\)"
			);
			let problemConstraints = await this.findProblemConstraints(
				texFilteredResp,
				contestId,
				index
			);
			let problemStatement = await this.findProblemStatement(
				texFilteredResp,
				contestId,
				index
			);
			let problemInput = await this.findProblemInput(
				texFilteredResp,
				contestId,
				index
			);
			let problemOutput = await this.findProblemOutput(
				texFilteredResp,
				contestId,
				index
			);
			let problemTestCases = await this.findProblemTestCases(
				texFilteredResp,
				contestId,
				index
			);
			let problemNote = await this.findProblemNote(
				texFilteredResp,
				contestId,
				index
			);
			if (
				!problemConstraints ||
				!problemStatement ||
				!problemInput ||
				!problemOutput ||
				!problemTestCases
			)
				return false;
			return {
				constraints: problemConstraints,
				statement: problemStatement,
				input: problemInput,
				output: problemOutput,
				testCases: problemTestCases,
				note: problemNote,
			};
		} catch (e) {
			console.log(
				`Couldn't fetch problem ${contestId}${index} content: ` + e
			);
		}
	}
}

export default CodeforcesAPI;
