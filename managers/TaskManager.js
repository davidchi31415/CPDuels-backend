import CodeforcesAPI from "../utils/api/codeforcesAPI.js";
import CodeforcesScraper from "../utils/scrapers/codeforcesScraper.js";
import db from "../server.js";
import superagent from "superagent";
import enableProxy from "superagent-proxy";
enableProxy(superagent);
let client = superagent.agent();

class TaskManager {
  static async getProxies() {
    let proxyLinks = [
      //   "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
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

  static async checkProxy(proxy, result) {
    let urlProxy = `http://${proxy}`;
    return new Promise(async (resolve, reject) => {
      try {
        await superagent
          .get("https://httpbin.org/ip?json")
          .proxy(urlProxy)
          .timeout({ response: 5000, deadline: 5000 })
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

  static async findCsrf(body) {
    let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
    return body.match(re)[0];
  }

  static async getUserAgents() {
    let resp = await superagent.get(
      "https://gist.githubusercontent.com/pzb/b4b6f57144aea7827ae4/raw/cf847b76a142955b1410c8bcef3aabe221a63db1/user-agents.txt"
    );
    let userAgents = resp.text.split("\n");
    return userAgents;
  }

  static getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static async proxyGet(URL) {
    let proxy = this.getRandom(wProx);
    let userAgent = this.getRandom(useragents);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Proxy: ${proxy}`);
    console.log(`url: ${URL}`);
    return await client.get(URL).set("User-agent", userAgent).proxy(proxy);
  }

  static async proxyPost(data) {
    let proxy = this.getRandom(wProx);
    let userAgent = this.getRandom(useragents);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Proxy: ${proxy}`);
    console.log(`url: ${data[0]}`);
    return await client
      .post(data[0])
      .set("User-agent", userAgent)
      .proxy(proxy)
      .send(data[1])
      .set("Content-Type", "application/x-www-form-urlencoded");
  }

  static async updateProblemsets() {
    await CodeforcesAPI.updateProblemsInDatabase();
    // await AtcoderAPI.updateProblemsInDatabase();
    // await LeetcodeAPI.updateProblemsInDatabase();
  }

  // Duel Management

  static async createDuelProblems(
    platform,
    numProblems,
    usernames,
    ratingMin,
    ratingMax
  ) {
    let problems;
    if (platform === "CF") {
      problems = await CodeforcesAPI.generateProblems(
        numProblems,
        usernames,
        ratingMin,
        ratingMax
      );
    } else if (platform === "AT") {
      // problems = await AtcoderAPI.generateProblems(numProblems, usernames, ratingMin, ratingMax);
    } else if (platform === "LC") {
      // problems = await LeetcodeAPI.generateProblems(numProblems, usernames, ratingMin, ratingMax);
    } else {
      // Error
    }
    return problems;
  }

  static async getUserSolves(duel, username) {
    let filteredSubmissions = await CodeforcesAPI.getUserSubmissionsAfterTime(
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

let useragents = await TaskManager.getUserAgents();
let proxies = await TaskManager.getProxies();
let wProx = [];

setInterval(async function () {
  wProx = await TaskManager.getWorkingProxies(proxies);
  console.log(`There are currently ${wProx.length} working proxies`);
}, 5000);
export { wProx };
export { client };
export default TaskManager;
