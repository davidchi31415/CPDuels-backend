import CodeforcesAPI from "../utils/api/codeforcesAPI.js";
import db from "../server.js";
import superagent from "superagent";
import enableProxy from "superagent-proxy";
enableProxy(superagent);

class TaskManager {
  constructor() {
    this.client = superagent.agent();
    this.codeforcesAPI = new CodeforcesAPI(this);
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

  static findCsrf(body) {
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
    let proxy = this.getRandom(wProx);
    let userAgent = this.getRandom(useragents);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Proxy: ${proxy}`);
    console.log(`url: ${URL}`);
    return await this.client.get(URL).set("User-agent", userAgent).proxy(proxy);
  }

  async proxyPost(data) {
    let proxy = this.getRandom(wProx);
    let userAgent = this.getRandom(useragents);
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
    await this.codeforcesAPI.updateProblemsInDatabase();
    // await this.atcoderAPI.updateProblemsInDatabase();
    // await this.leetcodeAPI.updateProblemsInDatabase();
  }

  // Duel Management

  async isValidDuelRequest(
    platform,
    players,
    problemCount,
    ratingMin,
    ratingMax,
    timeLimit
  ) {
    let validProblemCount =
      problemCount && problemCount >= 1 && problemCount <= 10;
    if (!validProblemCount) {
      return [false, "Invalid Problem Count"];
    }
    let validTimeLimit = timeLimit && timeLimit >= 5 && timeLimit <= 180;
    if (!validTimeLimit) {
      return [false, "Invalid Time Limit"];
    }
    let validParams;
    if (platform === "CF") {
      validParams = await this.codeforcesAPI.checkDuelParams(
        players[0].username,
        ratingMin,
        ratingMax
      );
    } else if (platform === "AT") {
      // validParams = await AtcoderAPI.checkDuelParams(players[0].username, ratingMin, ratingMax);
    } else if (platform === "LC") {
      // validParams = await LeetcodeAPI.checkDuelParams(players[0].username, ratingMin, ratingMax);
    } else {
      return [false, "Invalid Platform"];
    }
    if (!validParams[0]) return [false, validParams[1]];
    return [true];
  }

  async isValidJoinRequest(duel, username) {
    if (duel.players.length === 2) {
      // username multiple players joining at once
      return [false, "Duel Full"];
    }
    let owner = duel.players[0];
    if (owner.username === username) {
      return [false, "Duplicate Usernames"];
    }
    let validUsername;
    if (duel.platform === "CF") {
      validUsername = await this.codeforcesAPI.checkUsername(username);
    } else if (duel.platform === "AT") {
      // validUsername = await AtcoderAPI.checkUsername(username);
    } else {
      // validUsername = await LeetcodeAPI.checkUsername(username);
    }
    if (!validUsername[0]) {
      return [false, validUsername[1]];
    }
    return [true];
  }

  /*
   async isValidSubmitRequest(duel, uid, submission) {}
  */

  async createDuelProblems(duel) {
    let usernames = [duel.players[0].username, duel.players[1].username];
    let problems;
    if (platform === "CF") {
      problems = await this.codeforcesAPI.generateProblems(
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

  async submitProblem(duel, uid, submission) {
    let problem = duel.problems[submission.number - 1];
    if (duel.platform === "CF") {
      await this.codeforcesAPI.login();
      await this.codeforcesAPI.submitProblem(
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
    let filteredSubmissions = await this.codeforcesAPI.getUserSubmissionsAfterTime(
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
