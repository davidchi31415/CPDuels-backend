import superagent from "superagent";
import { sleep } from "../helpers/sleep.js";
import fetch from "node-fetch";
import ql from "superagent-graphql";
import db from "../../server.js";
import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import circularArray from "../helpers/circularArray.js";
import clipboardy from "clipboardy";
import { submissionModel } from "../../models/models.js";
import { headless } from "../../config/origins.js";

puppeteer.use(StealthPlugin());

class LeetcodeAPI {

  constructor() {
    this.loginInfo = ["cpduels-bot", "davidandjeffrey!1"];

    this.loggedIn = false;

    // Submitting
    this.currentSubmitBrowser = false;
    this.currentSubmitPage = false;
  }

  async init() {
    await this.puppeteerLogin();
  }

  ///////////////////////////////////////////////////////////
  // Submitting
  async ensureSubmitBrowser() {
    if (this.currentSubmitBrowser) return;
    this.currentSubmitBrowser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-gpu", "--disable-setuid-sandbox"],
      headless: headless,
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
      await page.goto("https://leetcode.com/accounts/login/", {
        waitUntil: "networkidle2",
      });
      await page.type("input[name=login]", this.loginInfo[0]);
      await page.type("input[name=password]", this.loginInfo[1]);
      await page.evaluate(() => {
        [...document.querySelectorAll('span')].find(element => element.innerHTML === 'Sign In').click();
      });
      try {
        // Successful login
        await page.waitForFunction("window.location.pathname == '/'")
        console.log(`Logged in to LC submit account.`);
        this.loggedIn = true;
      } catch {
        // Failed to login
        console.log(
          `Could not login to LC submit account: trying with next account`
        );
        await this.reLogin();
      }
    } catch (err) {
      console.log("Login Error: ", err);
      try {
        await this.currentSubmitBrowser.close();
      } catch (err) {
        console.log("Couldn't close LC submit browser: ", err);
      }
      await this.reLogin();
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
    this.loggedIn = false;
    console.log(`Logged out of LC submit account.`);
  }

  async reLogin() {
    await this.logout();
    await this.puppeteerLogin();
  }

  async puppeteerSubmitProblem(
    slug,
    problemName,
    problemNumber,
    sourceCode,
    lang, // string
    duelId,
    uid
  ) {
    try {
      let commentedsourceCode = `${sourceCode}`;
      await this.ensureLoggedIn();
      if (!this.currentSubmitBrowser) {
        console.log(
          `Submitting solution for ${slug} Failed: \n Could not open Puppeteer.`
        );
        return [
          false,
          `Submitting solution for ${slug} Failed: \n Could not open Puppeteer.`,
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
        `https://leetcode.com/problems/${slug}/`,
        {
          waitUntil: "networkidle2",
        }
      );
      await this.currentSubmitPage.evaluate(
        () => document.querySelector('#editor button').click()
      );
      await this.currentSubmitPage.evaluate(
        () => [...document.querySelectorAll('#editor li div')].find(element => element.innerHTML === "Python").click()
      );
      await clipboardy.writeSync(sourceCode);
      await this.currentSubmitPage.click(".monaco-editor");
      await this.currentSubmitPage.keyboard.down('Control');
      await this.currentSubmitPage.keyboard.press('A');
      await this.currentSubmitPage.keyboard.up('Control');
      await this.currentSubmitPage.keyboard.down('Control');
      await this.currentSubmitPage.keyboard.down('Shift');
      await this.currentSubmitPage.keyboard.press('KeyV');
      await this.currentSubmitPage.keyboard.up('Control');
      await this.currentSubmitPage.keyboard.up('Shift')
      await this.currentSubmitPage.evaluate(
        () => [...document.querySelectorAll('button')].find(element => element.innerHTML === "Submit").click()
      );
      this.currentSubmissionCount++;
      let submissionId;
      try {
        // Solution successfully submitted
        const submissionResponse = await this.currentSubmitPage.waitForResponse(
          response => response.url().includes("submit")
        );
        let submissionResponseContent = await submissionResponse.json();
        let re = /problems\/([\s\S]*?)\/submit/;
        let slug = submissionResponse.url().match(re)[1];
        submissionId = submissionResponseContent.submission_id;
        console.log("Leetcode Submission Id Retreived: ", submissionId);
        await submissionModel.create(
          {
            platform: "LC",
            problemName: problemName,
            problemNumber: problemNumber,
            url: `https://www.leetcode.com/problems/${slug}/submissions/${submissionId}`,
            duelId: duelId,
            uid: uid,
            submissionId: submissionId,
            status: ["PENDING"],
          }
        );
      } catch (e) {
        // Solution failed to submit
        console.log(
          `Submitting solution failed with account ${this.currentAccount}: \n ${e} \n Switching accounts and resubmitting`
        );
        await this.switchAccounts();
        return await this.puppeteerSubmitProblem(
          slug,
          problemName,
          problemNumber,
          sourceCode,
          lang,
          duelId,
          uid
        );
      }
      console.log(
        `Solution for ${slug} submitted successfully.`
      );
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
        slug,
        problemName,
        problemNumber,
        sourceCode,
        lang,
        duelId,
        uid
      );
    }
  }

  ///////////////////////////////////////////////////////////
  // Updating Submissions
  
  async updateSubmissionVerdict(rawVerdict, submissionId) {
    const verdict = rawVerdict.toUpperCase();
    if (verdict.includes("WRONG ANSWER")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["WRONG ANSWER"],
          },
        }
      );
    } else if (verdict.includes("COMPILE ERROR")) {
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
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["RUNTIME ERROR"],
          },
        }
      );
    } else if (verdict.includes("TIME LIMIT EXCEEDED")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["TIME LIMIT EXCEEDED"],
          },
        }
      );
    } else if (verdict.includes("MEMORY LIMIT EXCEEDED")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["MEMORY LIMIT EXCEEDED"],
          },
        }
      );
    } else if (verdict.includes("IDLENESS LIMIT EXCEEDED")) {
      await submissionModel.findOneAndUpdate(
        {
          submissionId: submissionId,
        },
        {
          $set: {
            status: ["IDLENESS LIMIT EXCEEDED"],
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
    try {
      let verdictContent;
      let submissionContent = await this.getSubmission(submission.submissionId);
      verdictContent = submissionContent.statusDisplay;
      if (!verdictContent) {
        console.log(
          `Could not update submission ${submissionContent.submissionId}: \n Verdict not found.`
        );
        return; // Don't update if verdict content is undefined
      }
      console.log(verdictContent);
      await this.updateSubmissionVerdict(verdictContent, submission.id);
    } catch (err) {
      console.log("Check Error: ", err);
    }
  }

  async getPendingSubmissionsFromDatabase() {
    let result = await db
      .collection("submissions")
      .find(
        {
          platform: "LC",
          status: {$in: ["PENDING"]},
        },
        {}
      )
      .toArray();
    return result;
  }

  async updateSubmissions() {
    let dbSubmissions = await this.getPendingSubmissionsFromDatabase();
    if (!dbSubmissions.length) {
      console.log("There are no LC sumissions to update.");
      return false;
    }
    for (let i = 0; i < dbSubmissions.length; i++) {
      await this.updateSubmission(dbSubmissions[i]);
    }
    let updatedSubmissions = [];
    // for (const item of dbSubmissions) {
    //   let res = await submissionModel.findOne({
    //     submissionId: item.submissionId,
    //   });
    //   updatedSubmissions.push(res);
    // }
    return updatedSubmissions;
  }

  ///////////////////////////////////////////////////////////
  // Duels
  static checkDuelParams(ratingMin, ratingMax) {
    // For validating duel creation request
    if (typeof ratingMin !== "number" || typeof ratingMax !== "number") {
      return [false, "Invalid LC Rating Types"];
    }
    let inValidRatings = ratingMin > ratingMax;
    if (inValidRatings) {
      return [false, "Invalid LC Ratings"];
    }
    return [true, "good"];
  }

  static async getDBProblems(filter = {}, fields = {}) {
    // filter for the problems we're looking for
    // fields for the parts of the problems

    let result = await db
      .collection("lcproblemaccessors")
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
    let numBins = ratingMax - ratingMin + 1; // Number of rating bins
    let problems = [];
    if (numProblems <= numBins) {
      let subwidth = Math.floor(numBins / numProblems);
      let remBins = numBins - numProblems * subwidth; // Leftover bins (distributed into lower ratings first)
      let currMin = ratingMin;
      for (let i = 0; i < numProblems; i++) {
        let currMax = currMin + subwidth - 1;
        if (remBins) {
          // If there are leftover bins, add one more
          currMax += 1;
          remBins--;
        }
        if (unwantedIndices?.length && !unwantedIndices.includes(i)) {
          currMin = currMax + 1;
          continue;
        }
        let ratedProblems = await LeetcodeAPI.getDBProblems({
          difficulty: { $gte: currMin, $lte: currMax },
        });
        if (unwantedProblems?.length) {
          // If there are unwanted problems (i.e. regen) then filter them out
          ratedProblems = ratedProblems.filter((ratedProblem) => {
            return !unwantedProblems.some((unwantedProblem) => {
              unwantedProblem.slug === ratedProblem.slug;
            });
          });
        }
        let randomIndex = Math.floor(Math.random() * ratedProblems.length);
        problems.push(ratedProblems[randomIndex]);
        currMin = currMax + 1;
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
        let binRating = ratingMin + i;
        let ratedProblems = await LeetcodeAPI.getDBProblems({
          difficulty: { $eq: binRating },
        });
        if (unwantedProblems?.length) {
          // If there are unwanted problems (i.e. regen) then filter them out
          ratedProblems = ratedProblems.filter((ratedProblem) => {
            return !unwantedProblems.some((unwantedProblem) => {
              unwantedProblem.slug === ratedProblem.slug;
            });
          });
        }
        let actualBinWidth = currMax - currMin + 1; // Accounts for extra from remainder of problems
        for (let j = 0; j < actualBinWidth; j++) {
          // Skip if not unwanted problem index
          if (
            unwantedIndices?.length &&
            !unwantedIndices.includes(currMin + j)
          ) {
            continue;
          }
          // Divide into sections to ensure distinct problems
          let randomIndex = LeetcodeAPI.getRandomIndex(
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
    console.log(returnIndex, max);
    return returnIndex;
  }

  async generateProblems(numProblems, ratingMin, ratingMax) {
    let problems = await LeetcodeAPI.getRatedProblems(
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
    let problems = await LeetcodeAPI.getRatedProblems(
      numProblems,
      ratingMin,
      ratingMax,
      unwantedProblems,
      unwantedIndices
    );
    return problems;
  }

  ///////////////////////////////////////////////////////////
  // Scraping

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

  async getSubmission(id) {
    let submissions = await this.getRecentSubmissionList();
    for (let submission of submissions) {
      if (submission.id === id) {
        return submission;
      }
    }
    return false;
  }

  async getRecentSubmissionList() {
    let queryString = `
		  query getRecentSubmissionList($username: String!) {
        recentSubmissionList(username: $username) {
          id
          title
          titleSlug
          timestamp
				  runtime
          statusDisplay
				  isPending
          lang
				  url
        }
      }`;

    let queryVars = {
	    username: "cpduels-bot",
    };

    let res = await superagent
	    .get("https://leetcode.com/graphql")
	    .use(ql(queryString, queryVars));
    return JSON.parse(res.text).data.recentSubmissionList;
  }

  async getProblem(titleSlug) {
    let queryString = `
		query questionData($titleSlug: String!) {
			question(titleSlug: $titleSlug) {
			  questionId
			  questionFrontendId
			  boundTopicId
			  title
			  titleSlug
			  content
			  translatedTitle
			  translatedContent
			  isPaidOnly
			  difficulty
			  likes
			  dislikes
			  isLiked
			  similarQuestions
			  exampleTestcases
			  contributors {
				username
				profileUrl
				avatarUrl
			  }
			  topicTags {
				name
				slug
				translatedName
			  }
			  companyTagStats
			  codeSnippets {
				lang
				langSlug
				code
			  }
			  stats
			  hints
			  solution {
				id
				canSeeDetail
				paidOnly
				hasVideoSolution
				paidOnlyVideo
			  }
			  status
			  sampleTestCase
			  metaData
			  judgerAvailable
			  judgeType
			  mysqlSchemas
			  enableRunCode
			  enableTestMode
			  enableDebugger
			  envInfo
			  libraryUrl
			  adminUrl
			  challengeQuestion {
				id
				date
				incompleteChallengeCount
				streakCount
				type
			  }
			  note
			  __typename
			}
		  }`;

    let queryVars = {
      titleSlug: titleSlug,
    };

    let res = await superagent
      .get("https://leetcode.com/graphql")
      // .set(
      // 	"Cookie",
      // 	"csrf=liEwfqNngFMKxnjAzSK6cYA6gYYUmCn6HQcRkhx5no37xqVjQG8OfXF76LE3hUob"
      // )
      .use(ql(queryString, queryVars));
    return JSON.parse(res.text).data;
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
    console.log("Updating LC Problemset: Fetching From Leetcode");
    let list = await this.getProblemList();
    let filteredProblems = list
      .filter((problem) => !problem.paid_only)
      .map((problem) => {
        return {
          name: problem.stat.question__title,
          slug: problem.stat.question__title_slug,
          difficulty: problem.difficulty.level,
        };
      }); // Get only the unpaid problems and project their title, slug, and difficulty
    console.log(filteredProblems);
    let scraped_problems = [];
    for (let i = 0; i < filteredProblems.length; i++) {
      let res = await this.getProblem(filteredProblems[i].slug);
      let problemData = res.question;
      let problemPreview = this.findProblemPreview(problemData.content);
      if (!problemPreview) {
        console.log(
          `Couldn't get problem preview for ${filteredProblems[i].slug}`
        );
        continue;
      }
      scraped_problems.push({
        ...filteredProblems[i],
        content: {
          problemWhole: problemData.content,
          problemPreview: problemPreview,
          codeSnippets: problemData.codeSnippets,
        },
      });
      console.log(
        `Updating LC Problemset: ${i + 1}/${filteredProblems.length}`
      );
    }
    await db.collection("lcproblems").insertMany(scraped_problems);
    console.log(scraped_problems);
    console.log("LC Problemset successfully updated.");
  }
  findProblemPreview(body) {
    let re1 = /([\s\S]*?)<strong class="example">/;
    let problemPreview = body.match(re1)[1];
    return problemPreview;
  }

  async testing() {
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
