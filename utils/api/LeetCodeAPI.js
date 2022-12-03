import superagent from "superagent";
import { sleep } from "../helpers/sleep.js";
import fetch from "node-fetch";

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
	async getProblemList() {
		const url = "https://leetcode.com/api/problems/all/";
		// const response = await LeetcodeAPI.getAPIResponse(url);
		const response = JSON.parse((await superagent.get(url)).text);
		if (!response) {
			return false;
		}
		return response["stat_status_pairs"];
	}
	async updateProblemsInDatabase() {
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
