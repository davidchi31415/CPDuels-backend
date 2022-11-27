import fetch from "node-fetch";
import { sleep } from "../helpers/sleep.js";
import cheerio from "cheerio";
import db from "../../server.js";
import superagent from "superagent";
import { findCsrf } from "../helpers/findCsrf.js";
import circularArray from "../helpers/circularArray.js";
import { ObjectId } from "mongodb";
import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import PortalPlugin from "puppeteer-extra-plugin-portal";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { submissionModel } from "../../models/models.js";

puppeteer.use(StealthPlugin());

// puppeteer.use(StealthPlugin()).use(
// 	PortalPlugin({
// 		webPortalConfig: {
// 			listenOpts: {
// 				port: 3000,
// 			},
// 			baseUrl: "http://localhost:3000",
// 		},
// 	})
// );

class CodeforcesAPI {
  constructor() {
    //this.client = superagent.agent();
    this.loginInfo = new circularArray([
      ["cpduels-bot", "davidandjeffrey"],
      ["cpduels-bot2", "davidandjeffrey"],
      ["cpduels-bot3", "davidandjeffrey"],
      ["cpduels-bot4", "davidandjeffrey"],
      ["cpduels-bot5", "davidandjeffrey"],
      // ["cpduels-bot6", "davidandjeffrey"],
      // ["cpduels-bot7", "davidandjeffrey"],
      // ["cpduels-bot8", "davidandjeffrey"],
      // ["cpduels-bot9", "davidandjeffrey"],
      // ["cpduels-bot10", "davidandjeffrey"],
    ]);

    // Submitting
    this.currentSubmitBrowser = false;
    this.currentSubmitPage = false;
    this.loggedIn = false;
    this.currentSubmissionCount = 0;
    this.lastLoginTime = false;
    this.currentAccount = ""; // not logged in

    // Updating
    this.currentCheckerBrowser = false;
    this.currentCheckerPage = false;
  }

  //////////////////////////////////////////////////////////////////////////
  // Submitting

  toComment(programTypeId, text) {
    if (typeof programTypeId === "string")
      programTypeId = parseInt(programTypeId);
    console.log(programTypeId);
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

  async ensureSubmitBrowser() {
    if (this.currentSubmitBrowser) return;
    this.currentSubmitBrowser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      headless: false,
      ignoreHTTPSErrors: true,
      executablePath: executablePath(),
    });
  }
  async ensureLoggedIn() {
    if (this.loggedIn) return;
    await this.puppeteerLogin();
  }

  async puppeteerLogin() {
    await this.ensureSubmitBrowser();
    if (!this.currentSubmitBrowser) return false;
    const page = await this.currentSubmitBrowser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "image") request.abort();
      else request.continue();
    });
    page.goto("https://codeforces.com/enter/", {
      waitUntil: "networkidle2",
    });
    let login = this.loginInfo.getCurAndUpdate();
    await page.waitForSelector("input[id=handleOrEmail]");
    await page.type("input[id=handleOrEmail]", login[0]);
    await page.waitForSelector("input[id=password]");
    await page.type("input[id=password]", login[1]);
    await page.waitForSelector("input[class=submit]");
    await page.click("input[class=submit]");
    try {
      // Successful login
      await page.waitForSelector(`a[href="/profile/${login[0]}"]`);
      console.log(`Logged in to account ${login[0]}.`);
      this.lastLoginTime = Date.now();
      this.loggedIn = true;
      this.currentAccount = login[0];
    } catch {
      // Failed to login
      console.log(
        `Could not login with account ${login[0]}: trying with next account`
      );
      await this.switchAccounts();
    }
  }

  async logout() {
    await this.currentSubmitBrowser.close();
    this.currentSubmitBrowser = false;
    this.currentSubmitPage = false;
    this.currentSubmissionCount = 0;
    this.loggedIn = false;
    console.log(`Logged out of account ${this.currentAccount}.`);
    this.currentAccount = "";
  }

  async switchAccounts() {
    console.log("Switching accounts.");
    await this.logout();
    await this.puppeteerLogin();
  }

  checkIfLogoutNecessary() {
    if (!this.lastLoginTime || !this.currentSubmitBrowser) return false;
    if (this.currentSubmissionCount >= 20) return true;
    return false;
  }

  async puppeteerSubmitProblem(
    contestId,
    problemIndex,
    problemName,
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
      await this.ensureLoggedIn();
      if (!this.currentSubmitBrowser) {
        console.log(
          `Submitting solution for ${contestId}${problemIndex} Failed: \n Could not open Puppeteer for submitting.`
        );
        return [
          false,
          `Submitting solution for ${contestId}${problemIndex} Failed: \n Could not open Puppeteer for submitting.`,
        ];
      }
      if (!this.currentSubmitPage) {
        this.currentSubmitPage = await this.currentSubmitBrowser.newPage();
        await this.currentSubmitPage.setRequestInterception(true);
        this.currentSubmitPage.on("request", (request) => {
          if (request.resourceType() === "image") request.abort();
          else request.continue();
        });
      }
      this.currentSubmitPage.goto(
        `https://codeforces.com/contest/${contestId}/submit`,
        {
          waitUntil: "networkidle2",
        }
      );
      await this.currentSubmitPage.waitForSelector(
        'select[name="submittedProblemIndex"]'
      );
      await this.currentSubmitPage.select(
        'select[name="submittedProblemIndex"]',
        problemIndex.toUpperCase()
      );
      await this.currentSubmitPage.waitForSelector(
        'select[name="programTypeId"]'
      );
      await this.currentSubmitPage.select(
        'select[name="programTypeId"]',
        `${programTypeId}`
      );
      await this.currentSubmitPage.waitForSelector(
        'textarea[id="sourceCodeTextarea"]'
      );
      await this.currentSubmitPage.evaluate((sourceCode) => {
        return (document.querySelector(
          'textArea[id="sourceCodeTextarea"]'
        ).innerHTML = sourceCode);
      }, sourceCode);
      await this.currentSubmitPage.waitForSelector('input[value="Submit"]');
      await this.currentSubmitPage.click('input[value="Submit"]');
      this.currentSubmissionCount++;
      try {
        // Solution successfully submitted
        await this.currentSubmitPage.waitForSelector('a[title="Source"]');
        const submissionId = await this.currentSubmitPage.evaluate(
          () => document.querySelector('a[title="Source"]').innerHTML
        );
        console.log(`CF Submission Id retrieved: ${submissionId}`);
        await submissionModel.create({
          platform: "CF",
          problemName: problemName,
          url: `https://www.codeforces.com/contest/${contestId}/submission/${submissionId}`,
          duelId: duelId,
          uid: uid,
          submissionId: submissionId,
          status: "PENDING",
        });
      } catch (e) {
        // Solution failed to submit
        console.log(
          `Submitting solution failed with account ${this.currentAccount}: \n ${e} \n Switching accounts and resubmitting`
        );
        await this.switchAccounts();
        await this.puppeteerSubmitProblem(
          contestId,
          problemIndex,
          problemName,
          sourceCode,
          programTypeId,
          duelId,
          uid
        );
        return;
      }
      console.log(
        `Solution for ${contestId}${problemIndex} submitted successfully.`
      );
      if (this.checkIfLogoutNecessary()) await this.switchAccounts();
      return [true];
    } catch (err) {
      console.log(
        `Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`
      );
      return [
        false,
        `Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`,
      ];
    }
  }

  /////////////////////////////////////////////////////////////////////////////////
  // Updating Submissions

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

  async ensureCheckerBrowser() {
    if (this.currentCheckerBrowser) return;
    this.currentCheckerBrowser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      headless: false,
      ignoreHTTPSErrors: true,
      executablePath: executablePath(),
    });
  }

  async updateSubmissionVerdict(rawVerdict, submissionId) {
    const verdict = rawVerdict.toUpperCase();
    if (verdict.includes("WRONG ANSWER")) {
      let re = /<span class="verdict-format-judged">([\s\S]*?)<\/span>/;
      let testCaseNumber = rawVerdict.match(re)[1];
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["WRONG ANSWER", testCaseNumber],
          },
        }
      );
    } else if (verdict.includes("COMPILATION ERROR")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["COMPILATION ERROR"],
          },
        }
      );
    } else if (verdict.includes("RUNTIME ERROR")) {
      let re = /<span class="verdict-format-judged">([\s\S]*?)<\/span>/;
      let testCaseNumber = rawVerdict.match(re)[1];
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["RUNTIME ERROR", testCaseNumber],
          },
        }
      );
    } else if (verdict.includes("TIME LIMIT EXCEEDED")) {
      let re = /<span class="verdict-format-judged">([\s\S]*?)<\/span>/;
      let testCaseNumber = rawVerdict.match(re)[1];
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["TIME LIMIT EXCEEDED", testCaseNumber],
          },
        }
      );
    } else if (verdict.includes("MEMORY LIMIT EXCEEDED")) {
      let re = /<span class="verdict-format-judged">([\s\S]*?)<\/span>/;
      let testCaseNumber = rawVerdict.match(re)[1];
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["MEMORY LIMIT EXCEEDED", testCaseNumber],
          },
        }
      );
    } else if (verdict.includes("IDLENESS LIMIT EXCEEDED")) {
      let re = /<span class="verdict-format-judged">([\s\S]*?)<\/span>/;
      let testCaseNumber = rawVerdict.match(re)[1];
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["IDLENESS LIMIT EXCEEDED", testCaseNumber],
          },
        }
      );
    } else if (verdict.includes("ACCEPTED")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["ACCEPTED"],
          },
        }
      );
    } else {
      console.log("Submission not updated: still pending.");
    }
  }

  async updateSubmission(submission) {
    await this.ensureCheckerBrowser();
    if (!this.currentCheckerBrowser) {
      console.log("Could not open Puppeteer for checking.");
      return [false, "Could not open Puppeteer for checking."];
    }
    if (!this.currentCheckerPage) {
      this.currentCheckerPage = await this.currentCheckerBrowser.newPage();
      await this.currentCheckerPage.setRequestInterception(true);
      this.currentCheckerPage.on("request", (request) => {
        if (request.resourceType() === "image") request.abort();
        else request.continue();
      });
    }
    try {
      console.log(submission.url);
      await this.currentCheckerPage.goto(submission.url, {
        waitUntil: "domcontentloaded",
      });
      await this.currentCheckerPage.waitForSelector("td.bottom");
      let verdict = await this.currentCheckerPage.evaluate(
        () => document.querySelector("table td:nth-of-type(5)")?.innerHTML
      );
      if (!verdict) {
        console.log(
          `Could not update submission ${submission.submissionId}: \n Verdict not found.`
        );
      }
      await this.updateSubmissionVerdict(verdict, submission.submissionId);
    } catch (err) {
      console.log(
        `Could not update submission ${submission.submissionId}: \n ${err}`
      );
    }
  }

  async getPendingSubmissionsFromDatabase() {
    let result = await db
      .collection("submissions")
      .find(
        {
          platform: "CF",
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
      console.log("There are no CF sumissions to update.");
      return;
    }
    for (let i = 0; i < dbSubmissions.length; i++) {
      await this.updateSubmission(dbSubmissions[i]);
    }
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Duels

  async checkUsername(username) {
    const url = `https://codeforces.com/api/user.info?handles=${username}`;
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
    let validUsername;
    if (username === "!GUEST!") validUsername = true;
    else validUsername = await this.checkUsername(username);
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
        if (!submission.hasOwnProperty("verdict")) submission.verdict = null;
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
        if (!submission.hasOwnProperty("verdict")) submission.verdict = null;
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
    let submissions1 = [];
    if (usernames[0] !== "!GUEST!")
      submissions1 = await this.getUserSubmissions(usernames[0]);
    let submissions2 = [];
    if (usernames[1] !== "!GUEST!")
      submissions2 = await this.getUserSubmissions(usernames[1]);
    let combined_submissions = submissions1.concat(
      submissions2.filter((item) => submissions1.indexOf(item) < 0)
    );

    //contestId index
    let filteredProblems = ratedProblems;
    if (combined_submissions.length != 0) {
      filteredProblems = ratedProblems.filter((problem) => {
        return !combined_submissions.some((f) => {
          return f.contestId === problem.contestId && f.index === problem.index;
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

  async updateProblemsInDatabase() {
    console.log("Updating CF Problemset: fetching CF Problems");
    let problem_list = await this.getProblemList();
    console.log("Updating CF Problemset: scraping CF Problems");
    let scraped_problems = [];
    for (let i = 0; i < 100; i++) {
      let interactive = false;
      for (let j = 0; j < problem_list[i].tags?.length; j++) {
        if (problem_list[i].tags[j] === "interactive") interactive = true; // TO DO
      }
      if (interactive) continue;
      let content = await this.getProblemContent(
        problem_list[i].contestId,
        problem_list[i].index
      );
      if (!content) continue; // if problem was not properly scraped
      scraped_problems.push({ ...problem_list[i], content: content });
      console.log(
        `Updating CF Problemset: scraped ${i + 1}/${problem_list.length}`
      );
    }
    db.collection("cfproblems").insertMany(scraped_problems);
    console.log(scraped_problems);
    console.log("CF Problemset successfully updated.");
  }

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
      console.log(`Couldn't fetch problem ${contestId}${index} input: ` + e);
    }
  }

  async findProblemOutput(body, contestId, index) {
    let re =
      /<div class="output-specification"><div class="section-title">Output<\/div>([\s\S]*?)<\/div><div class="sample-tests">/;
    try {
      return body.match(re)[1];
    } catch (e) {
      console.log(`Couldn't fetch problem ${contestId}${index} input: ` + e);
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
          `Couldn't fetch problem ${contestId}${index}, will retry: ` + e
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
      console.log(`Couldn't fetch problem ${contestId}${index} content: ` + e);
    }
  }
}

export default CodeforcesAPI;
