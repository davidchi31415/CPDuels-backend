import superagent from "superagent";
import enableProxy from "superagent-proxy";
enableProxy(superagent);
let client = superagent.agent();

class ProxyManager {
	static async getProxies() {
		let proxyLinks = [
			// "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
			// "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt",
			"https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
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

	static async getUserAgents() {
		let resp = await superagent.get(
			"https://gist.githubusercontent.com/pzb/b4b6f57144aea7827ae4/raw/cf847b76a142955b1410c8bcef3aabe221a63db1/user-agents.txt"
		);
		let userAgents = resp.text.split("\n");
		return userAgents;
	}

	static async checkProxy(proxy, result) {
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

	static async getWorkingProxies(proxies) {
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

	static getRandom(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	static async proxyGet(URL) {
		let useragents = await this.getUserAgents();
		let proxy = this.getRandom(wProx);
		let userAgent = this.getRandom(useragents);
		console.log(`User-Agent: ${userAgent}`);
		console.log(`Proxy: ${proxy}`);
		console.log(`url: ${URL}`);
		return await client.get(URL).set("User-agent", userAgent).proxy(proxy);
	}

	static async proxyPost(data) {
		let useragents = await this.getUserAgents();
		let proxy = this.getRandom(wProx);
		let userAgent = this.getRandom(useragents);
		console.log(`User-Agent: ${userAgent}`);
		console.log(`Proxy: ${proxy}`);
		console.log(`url: ${data[0]}`);
		await client
			.post(data[0])
			.set("User-agent", userAgent)
			.proxy(proxy)
			.send(data[1])
			.set("Content-Type", "application/x-www-form-urlencoded")
			.then(
				console.log(
					`Submitted solution for ${data[1].contestId}${data[1].submittedProblemIndex}`
				)
			);
	}
}

let proxies = await ProxyManager.getProxies();
let wProx = [];
let curProx;

setInterval(async function () {
	wProx = await ProxyManager.getWorkingProxies(proxies);
	console.log(`There are currently ${wProx.length} working proxies`);
}, 5000);

export default ProxyManager;
export { wProx };
