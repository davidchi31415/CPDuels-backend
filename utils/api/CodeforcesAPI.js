import fetch from "node-fetch";
import { sleep } from "../helpers/sleep.js";
import db from "../../server.js";
import superagent from "superagent";
import { findCsrf } from "../helpers/findCsrf.js";
import circularArray from "../helpers/circularArray.js";
import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import PortalPlugin from "puppeteer-extra-plugin-portal";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { submissionModel } from "../../models/models.js";
import DEBUG from "../../config/debug.js";

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

    // Scraping
    this.currentScraperBrowser = false;
    this.currentScraperPage = false;
  }

  async init() {
    await this.puppeteerLogin();
    await this.ensureCheckerBrowser();
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
      headless: true,
      ignoreHTTPSErrors: true,
      executablePath: executablePath(),
    });
  }

  async ensureLoggedIn() {
    if (this.loggedIn) return;
    await this.puppeteerLogin();
  }

  async puppeteerLogin() {
    try {
      await this.ensureSubmitBrowser();
      const page = await this.currentSubmitBrowser.newPage();
      page.setDefaultTimeout(8000); // 8 second timeout
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.resourceType() === "image") request.abort();
        else request.continue();
      });
      await page.goto("https://codeforces.com/enter/", {
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
    } catch (err) {
      console.log("Login Error: ", err);
      try {
        await this.currentSubmitBrowser.close();
      } catch (err) {
        console.log("Couldn't close submit broswer: ", err);
      }
      this.loggedIn = false;
      this.currentSubmitBrowser = false;
      this.currentSubmitPage = false;
      await this.puppeteerLogin();
    }
  }

  async logout() {
    try {
      await this.currentSubmitBrowser.close();
    } catch (err) {
      console.log("Couldn't close submit browser.");
    }
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
    problemNumber,
    sourceCode,
    programTypeId,
    duelId,
    uid
  ) {
    try {
      let commentedsourceCode = `${this.toComment(
        programTypeId,
        `${Date.now()}`
      )}\n${sourceCode}`;
      await this.ensureLoggedIn();
      if (!this.currentSubmitBrowser) {
        console.log(
          `Submitting solution for ${contestId}${problemIndex} Failed: \n Could not open Puppeteer.`
        );
        return [
          false,
          `Submitting solution for ${contestId}${problemIndex} Failed: \n Could not open Puppeteer.`,
        ];
      }
      if (!this.currentSubmitPage) {
        this.currentSubmitPage = await this.currentSubmitBrowser.newPage();
        await this.currentSubmitPage.setDefaultTimeout(8000);
        await this.currentSubmitPage.setRequestInterception(true);
        this.currentSubmitPage.on("request", (request) => {
          if (request.resourceType() === "image") request.abort();
          else request.continue();
        });
      }
      await this.currentSubmitPage.goto(
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
      await this.currentSubmitPage.evaluate((commentedsourceCode) => {
        document.querySelector('textArea[id="sourceCodeTextarea"]').innerHTML =
          commentedsourceCode;
      }, commentedsourceCode);
      await this.currentSubmitPage.waitForSelector('input[value="Submit"]');
      await this.currentSubmitPage.evaluate(() => {
        document
          .querySelector('input[value="Submit"]')
          .removeAttribute("disabled");
      });
      await this.currentSubmitPage.click('input[value="Submit"]');
      this.currentSubmissionCount++;
      let submissionId;
      try {
        // Solution successfully submitted
        await this.currentSubmitPage.waitForSelector('a[title="Source"]');
        submissionId = await this.currentSubmitPage.evaluate(
          () => document.querySelector('a[title="Source"]').innerHTML
        );
        console.log(`CF Submission Id retrieved: ${submissionId}`);
        await submissionModel.create({
          platform: "CF",
          problemName: problemName,
          problemNumber: problemNumber,
          url: `https://www.codeforces.com/contest/${contestId}/submission/${submissionId}`,
          duelId: duelId,
          uid: uid,
          submissionId: submissionId,
          status: ["PENDING"],
        });
      } catch (e) {
        // Solution failed to submit
        console.log(
          `Submitting solution failed with account ${this.currentAccount}: \n ${e} \n Switching accounts and resubmitting`
        );
        await this.switchAccounts();
        return await this.puppeteerSubmitProblem(
          contestId,
          problemIndex,
          problemName,
          problemNumber,
          sourceCode,
          programTypeId,
          duelId,
          uid
        );
      }
      console.log(
        `Solution for ${contestId}${problemIndex} submitted successfully.`
      );
      if (this.checkIfLogoutNecessary()) await this.switchAccounts();
      return [true, submissionId];
    } catch (err) {
      console.log("Submit Error: ", err);
      try {
        await this.currentSubmitBrowser.close();
      } catch (err) {
        console.log("Couldn't close submit broswer: ", err);
      }
      this.loggedIn = false;
      this.currentSubmitBrowser = false;
      this.currentSubmitPage = false;
      await this.puppeteerSubmitProblem(
        contestId,
        problemIndex,
        problemName,
        problemNumber,
        sourceCode,
        programTypeId,
        duelId,
        uid
      );
    }
  }

  /////////////////////////////////////////////////////////////////////////////////
  // Updating Submissions
  async ensureCheckerBrowser() {
    if (this.currentCheckerBrowser) return;
    this.currentCheckerBrowser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      headless: true,
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
    let verdict;
    try {
      await this.ensureCheckerBrowser();
      if (!this.currentCheckerBrowser) {
        console.log("Checking submission failed: could not open Puppeteer.");
        return [false, "Checking submission failed: Could not open Puppeteer."];
      }
      if (!this.currentCheckerPage) {
        this.currentCheckerPage = await this.currentCheckerBrowser.newPage();
        this.currentCheckerPage.setDefaultTimeout(8000); // 8 second timeout
        await this.currentCheckerPage.setRequestInterception(true);
        this.currentCheckerPage.on("request", (request) => {
          if (request.resourceType() === "image") request.abort();
          else request.continue();
        });
      }
      console.log(submission.url);
      await this.currentCheckerPage.goto(submission.url, {
        waitUntil: "domcontentloaded",
      });
      await this.currentCheckerPage.waitForSelector("td.bottom");
      verdict = await this.currentCheckerPage.evaluate(
        () => document.querySelector("table td:nth-of-type(5)")?.innerHTML
      );
      if (!verdict) {
        console.log(
          `Could not update submission ${submission.submissionId}: \n Verdict not found.`
        );
      }
    } catch (err) {
      console.log("Check Error: ", err);
      try {
        await this.currentCheckerBrowser.close();
      } catch (err) {
        console.log("Couldn't close checker broswer: ", err);
      }
      this.currentCheckerBrowser = false;
      this.currentCheckerPage = false;
      return await this.updateSubmission(submission);
    }
    try {
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
      return false;
    }
    for (let i = 0; i < dbSubmissions.length; i++) {
      await this.updateSubmission(dbSubmissions[i]);
    }
    let updatedSubmissions = [];
    for (const item of dbSubmissions) {
      let res = await submissionModel.findOne({
        submissionId: item.submissionId,
      });
      updatedSubmissions.push(res);
    }
    return updatedSubmissions;
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Duels

  static checkDuelParams(ratingMin, ratingMax) {
    // For validating duel creation request
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

  static async getDBProblems(filter = {}, fields = {}) {
    // filter for the problems we're looking for
    // fields for the parts of the problems

    let result = await db
      .collection("cfproblemaccessors")
      .find(filter, fields)
      .toArray();

    return result;
  }

  static async getRatedProblems(
    numProblems,
    ratingMin,
    ratingMax,
    unwantedProblems,
    unwantedIndices
  ) {
    let numBins = (ratingMax - ratingMin) / 100 + 1; // Number of rating bins
    console.log(numProblems, numBins);
    let problems = [];
    if (numProblems <= numBins) {
      let subwidth = Math.floor(numBins / numProblems);
      let remBins = numBins - numProblems * subwidth; // Leftover bins (distributed into lower ratings first)
      let currMin = ratingMin;
      for (let i = 0; i < numProblems; i++) {
        let currMax = currMin + (subwidth - 1) * 100;
        if (remBins) {
          // If there are leftover bins, add one more
          currMax += 100;
          remBins--;
        }
        if (unwantedIndices?.length && !unwantedIndices.includes(i)) {
          currMin = currMax + 100;
          continue;
        }
        let ratedProblems = await CodeforcesAPI.getDBProblems({
          rating: { $gte: currMin, $lte: currMax },
        });
        if (unwantedProblems?.length) {
          // If there are unwanted problems (i.e. regen) then filter them out
          ratedProblems = ratedProblems.filter((ratedProblem) => {
            return !unwantedProblems.some((unwantedProblem) => {
              unwantedProblem.contestId === ratedProblem.contestId &&
                unwantedProblem.index === ratedProblem.index;
            });
          });
        }
        let randomIndex = Math.floor(Math.random() * ratedProblems.length);
        problems.push(ratedProblems[randomIndex]);
        currMin = currMax + 100;
      }
    } else {
      let binWidth = Math.floor(numProblems / numBins);
      let remProblems = numProblems - numBins * binWidth; // Leftover problems (distributed into lower bins first)
      let currMin = 0; // Problem Index min
      for (let i = 0; i < numBins; i++) {
        let currMax = currMin + (binWidth - 1); // Problem Index max
        if (remProblems) {
          // If there are leftover bins, add one more
          currMax += 1;
          remProblems--;
        }
        if (
          unwantedIndices?.length &&
          !unwantedIndices.some((index) => {
            return index >= currMin && index <= currMax;
          })
        ) {
          currMin = currMax + 1;
          continue;
        }
        let binRating = ratingMin + i * 100;
        let ratedProblems = await CodeforcesAPI.getDBProblems({
          rating: { $eq: binRating },
        });
        if (unwantedProblems?.length) {
          // If there are unwanted problems (i.e. regen) then filter them out
          ratedProblems = ratedProblems.filter((ratedProblem) => {
            return !unwantedProblems.some((unwantedProblem) => {
              unwantedProblem.contestId === ratedProblem.contestId &&
                unwantedProblem.index === ratedProblem.index;
            });
          });
        }
        let actualBinWidth = currMax - currMin + 1; // Accounts for extra from remainder of problems
        for (let j = 0; j < actualBinWidth; j++) {
          ) {
          // Skip if not unwanted problem index
          if (
            unwantedIndices?.length &&
            !unwantedIndices.includes(currMin + j)
          ) {
            continue;
          }
          // Divide into sections to ensure distinct problems
          let randomIndex = CodeforcesAPI.getRandomIndex(
            (j * ratedProblems.length) / actualBinWidth,
            ((j + 1) * ratedProblems.length) / actualBinWidth
          );
          problems.push(ratedProblems[randomIndex]);
        }
        currMin = currMax + 1;
      }
    }
    return problems;
  }

  static getRandomIndex(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    let indexOverMin = Math.floor(Math.random() * (max - min)); // [0, max-min) because we don't want to include the last index
    let returnIndex = indexOverMin + min; // Get amount over min to index
    return returnIndex;
  }

  async generateProblems(numProblems, ratingMin, ratingMax) {
    let problems = await CodeforcesAPI.getRatedProblems(
      numProblems,
      ratingMin,
      ratingMax
    );
    return problems;
  }

  async regenerateProblems( // takes in array of old problems and generates new ones
    numProblems,
    unwantedProblems,
    unwantedIndices,
    ratingMin,
    ratingMax
  ) {
    let problems = await CodeforcesAPI.getRatedProblems(
      numProblems,
      ratingMin,
      ratingMax,
      unwantedProblems,
      unwantedIndices
    );
    return problems;
  }

  ////////////////////////////////////////////////////////////////////////////////////////
  // Scraper

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

  static async getContestList() {
    const url = "https://codeforces.com/api/contest.list";
    const response = await CodeforcesAPI.getAPIResponse(url);
    if (!response) {
      return false;
    }
    return response["result"];
  }

  static async getProblemList() {
    const url = "https://codeforces.com/api/problemset.problems";
    const response = await CodeforcesAPI.getAPIResponse(url);
    if (!response) {
      return false;
    }
    return response["result"]["problems"];
  }

  async ensureScraperBrowser() {
    if (this.currentScraperBrowser) return;
    this.currentScraperBrowser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      headless: true,
      ignoreHTTPSErrors: true,
      executablePath: executablePath(),
    });
  }

  async updateProblemsInDatabase() {
    console.log("Updating CF Problemset: fetching CF Problems");
    let problemList = await CodeforcesAPI.getProblemList();
    let filteredProblems = problemList.filter((problem) => {
      return problem.rating;
    }); // Get only the problems that have a rating
    console.log(filteredProblems);
    console.log("Updating CF Problemset: scraping CF Problems");
    let scraped_problems = [];
    for (let i = 0; i < filteredProblems.length; i++) {
      let interactive = false;
      for (let j = 0; j < filteredProblems[i].tags?.length; j++) {
        if (filteredProblems[i].tags[j] === "interactive") interactive = true; // TO DO
      }
      if (interactive) continue;
      let content = await this.getProblemContent(
        filteredProblems[i].contestId,
        filteredProblems[i].index
      );
      if (!content) continue; // if problem was not properly scraped
      scraped_problems.push({ ...filteredProblems[i], content: content });
      console.log(
        `Updating CF Problemset: scraped ${i + 1}/${filteredProblems.length}`
      );
    }
    await db.collection("cfproblems").insertMany(scraped_problems);
    console.log(scraped_problems);
    console.log("CF Problemset successfully updated.");
  }

  async findContestTitle(body, contestId, index) {
    let re = /href="\/contest\/([\s\S]*?)<\/a>/;
    try {
      let raw = body.match(re)[0];
      return raw;
    } catch (e) {
      console.log(`Couldn't fetch problem ${contestId}${index} title: ` + e);
    }
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
      await this.ensureScraperBrowser();
      if (!this.currentScraperBrowser) {
        console.log(
          `Scraping solution for ${contestId}${index} Failed: \n Could not open Puppeteer.`
        );
        return [
          false,
          `Scraping solution for ${contestId}${index} Failed: \n Could not open Puppeteer.`,
        ];
      }
      if (!this.currentScraperPage) {
        this.currentScraperPage = await this.currentScraperBrowser.newPage();
        await this.currentScraperPage.setDefaultTimeout(8000);
        await this.currentScraperPage.setRequestInterception(true);
        this.currentScraperPage.on("request", (request) => {
          if (request.resourceType() === "image") request.abort();
          else request.continue();
        });
      }
      await this.currentScraperPage.goto(
        `https://codeforces.com/problemset/problem/${contestId}/${index}`,
        {
          waitUntil: "domcontentloaded",
        }
      );
      let resp = await this.currentScraperPage.content();
      try {
        // translate Codeforces's inline and display equation delimiters to something MathJax understands
        let texFilteredResp = resp.replace(
          /\$\$\$\$\$\$(.*?)\$\$\$\$\$\$/g,
          "\\[$1\\]"
        );
        texFilteredResp = texFilteredResp.replace(
          /\$\$\$(.*?)\$\$\$/g,
          "\\($1\\)"
        );
        let problemTitle = await this.findContestTitle(
          texFilteredResp,
          contestId,
          index
        );
        problemTitle = problemTitle.toUpperCase();
        let wildContestNames = [
          "WILD",
          "FOOLS",
          "UNRATED",
          "SURPRISE",
          "UNKNOWN",
          "FRIDAY",
          "Q#",
          "TESTING",
          "MARATHON",
          "KOTLIN",
          "ONSITE",
          "EXPERIMENTAL",
          "ABBYY",
        ];
        for (let i = 0; i < wildContestNames.length; i++) {
          if (problemTitle.includes(wildContestNames[i])) {
            console.log("Contest is wild: ", wildContestNames[i]);
            return;
          }
        }
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
    } catch (e) {
      console.log(`Couldn't fetch problem ${contestId}${index}: ` + e);
      return;
    }
  }
}

export default CodeforcesAPI;
