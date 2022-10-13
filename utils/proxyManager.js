import superagent from "superagent";
let client = superagent.agent();

class ProxyManager {
	static async getProxies() {
		let proxyLinks = [
			"https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
			"https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt",
			"https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
		];
		let proxies = [];
		for (const link of proxyLinks) {
			let resp = await client.get(link);
			let p = resp.text.split("\n");
			proxies.push(...p);
		}
		return proxies;
	}

	static async getWorkingProxies(timeout) {
		let proxies = await getProxies();
		let workingProxies = [];
		await Promise.all(
			proxies.map(async (proxy) => {
				try {
					let split = proxy.split(":");
					let urlProxy = `http://${proxy}`;
					let response = await client
						.get("https://httpbin.org/ip?json")
						.proxy(urlProxy)
						.timeout(timeout);
					const body = JSON.parse(await response.text);
					workingProxies.push(`${body.origin}:${split[1]}`);
					return body;
				} catch {}
			})
		);
		return workingProxies;
	}

	static async getRandomWorkingProxyURL(timeout) {
		try {
			let workingProxies = await getWorkingProxies(timeout);
			while (workingProxies.length == 0) {
				timeout += 200;
				workingProxies = await getWorkingProxies(timeout);
			}
			return `http://${
				workingProxies[
					Math.floor(Math.random() * workingProxies.length)
				]
			}`;
		} catch {}
		return "";
	}
}

export default ProxyManager;
