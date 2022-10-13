import superagent from "superagent";
let client = superagent.agent();

class SubmissionManager {
	static async findCsrf(body) {
		let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
		return body.match(re)[0];
	}

	static async login() {
		try {
			let resp = await client.get("https://codeforces.com/enter/");
			let csrf = await this.findCsrf(resp.text);
			await client
				.post("http://codeforces.com/enter/")
				.send({
					_tta: "176",
					csrf_token: csrf,
					action: "enter",
					handleOrEmail: "",
					password: "",
				})
				.set("Content-Type", "application/x-www-form-urlencoded")
				.then((res) => {
					console.log(`Login Succeeded ${res.status}`);
				});
		} catch (err) {
			console.log(`Login failed: \n ${err}`);
		}
	}

	static async submit(contestId, problemIndex, sourceCode) {
		try {
			let resp = await client.get(
				`https://codeforces.com/contest/${contestId}/submit`
			);
			let csrf = await this.findCsrf(resp.text);
			let submitUrl = `https://codeforces.com/contest/${contestId}/submit?csrf_token=${csrf}`;
			await client
				.post(submitUrl)
				.send({
					csrf_token: csrf,
					action: "submitSolutionFormSubmitted",
					submittedProblemIndex: problemIndex,
					programTypeId: "73",
					contestId: contestId,
					source: sourceCode,
					tabSize: "4",
					_tta: "594",
					sourceCodeConfirmed: "true",
				})
				.set("Content-Type", "application/x-www-form-urlencoded")
				.then(
					console.log(
						`Submitted solution for ${contestId}${problemIndex}`
					)
				);
		} catch (err) {
			console.log(
				`Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`
			);
		}
	}
}

export default SubmissionManager;
