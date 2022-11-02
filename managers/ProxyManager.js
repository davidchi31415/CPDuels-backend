import superagent from "superagent";
import enableProxy from "superagent-proxy";
enableProxy(superagent);

class ProxyManager {
	constructor() {
		this.client = superagent.agent();
		this.useragents = [];
		this.proxies = [];
		this.wProx = [];
		this.currentProxIndex = 0;
	}
	async init() {
		this.useragents = await this.getUserAgents();
		this.proxies = await this.getProxies();

		setInterval(this.updateProxies.bind(this), 5000);
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
}

export default ProxyManager;
