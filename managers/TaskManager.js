import CodeforcesAPI from "../utils/api/codeforcesAPI.js";
import db from "../server.js";
import superagent from "superagent";
import enableProxy from "superagent-proxy";
import Queue from "../utils/helpers/queue.js";
enableProxy(superagent);

class TaskManager {
	constructor() {
		this.client = superagent.agent();
		this.queue = new Queue();
		this.useragents = [];
		this.proxies = [];
		this.wProx = [];
		this.currentProxIndex = 0;
	}
	async init() {
		// this.useragents = await this.getUserAgents();
		// this.proxies = await this.getProxies();

		// setInterval(this.updateProxies.bind(this), 5000);

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

	async updateProxies() {
		this.wProx = await this.getWorkingProxies(this.proxies);
		this.currentProxIndex = 0;
		console.log(`There are currently ${this.wProx.length} working proxies`);
	}

	async getProxies() {
		let proxyLinks = [
			"https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
			// "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt",
			// "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
		];
		let proxies = [];
		for (const link of proxyLinks) {
			let resp = await superagent.get(link);
			let p = resp.text.split("\n");
			proxies.push(...p);
		}
		console.log(`Got ${proxies.length} proxies`);
		return proxies;
	}

	async checkProxy(proxy, result) {
		let urlProxy = `http://${proxy}`;
		return new Promise(async (resolve, reject) => {
			try {
				await superagent
					.get("https://httpbin.org/ip?json")
					.proxy(urlProxy)
					.timeout({ response: 1500, deadline: 2000 })
					.then((err) => {
						result.push(urlProxy);
						// console.log(`${urlProxy} passed`);
						resolve();
					});
			} catch (err) {
				// console.log(err);
				resolve();
			}
		});
	}

	async getWorkingProxies(proxies) {
		let result = [];
		let promises = await proxies.map(async (proxy) => {
			await this.checkProxy(proxy, result);
		});
		await Promise.all(promises)
			.then((res) => {
				console.log("resolved");
			})
			.catch();
		return result;
	}

	findCsrf(body) {
		let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
		return body.match(re)[0];
	}

	async getUserAgents() {
		let resp = await superagent.get(
			"https://gist.githubusercontent.com/pzb/b4b6f57144aea7827ae4/raw/cf847b76a142955b1410c8bcef3aabe221a63db1/user-agents.txt"
		);
		let userAgents = resp.text.split("\n");
		return userAgents;
	}

	getRandom(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	async proxyGet(URL) {
		let proxy = this.getRandom(this.wProx);
		let userAgent = this.getRandom(this.useragents);
		// console.log(`User-Agent: ${userAgent}`);
		// console.log(`Proxy: ${proxy}`);
		// console.log(`url: ${URL}`);
		return await this.client
			.get(URL)
			.set("User-agent", userAgent)
			.proxy(proxy);
	}
	static async get(URL) {
		console.log("asdf");
		return await this.client.get(URL);
	}
	static async post(data) {
		return await this.client
			.post(data[0])
			.send(data[1])
			.set("Content-Type", "application/x-www-form-urlencoded");
	}

	async proxyPost(data) {
		let proxy = this.getRandom(this.wProx);
		let userAgent = this.getRandom(this.useragents);
		console.log(`User-Agent: ${userAgent}`);
		console.log(`Proxy: ${proxy}`);
		console.log(`url: ${data[0]}`);
		return await this.client
			.post(data[0])
			.set("User-agent", userAgent)
			.proxy(proxy)
			.send(data[1])
			.set("Content-Type", "application/x-www-form-urlencoded");
	}

	async updateProblemsets() {
		await CodeforcesAPI.updateProblemsInDatabase();
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
			problems = await CodeforcesAPI.generateProblems(
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
			await CodeforcesAPI.login();
			await CodeforcesAPI.submitProblem(
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
			await CodeforcesAPI.getUserSubmissionsAfterTime(
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
