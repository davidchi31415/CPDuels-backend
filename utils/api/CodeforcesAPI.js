import fetch from "node-fetch";
import { sleep } from "../helpers/sleep.js";
import { client } from "../../managers/TaskManager.js";
import TaskManager from "../../managers/TaskManager.js";
import CodeforcesScraper from "../scrapers/codeforcesScraper.js";

class CodeforcesAPI {
  static async api_response(url, params) {
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

  static async updateProblemsInDatabase() {
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
      let content = await CodeforcesScraper.getProblemContent(
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

  static async login() {
    try {
      let resp = await client.get("https://codeforces.com/enter/");
      let csrf = await TaskManager.findCsrf(resp.text);
      console.log(csrf);
      let res = await client
        .post("https://codeforces.com/enter/")
        .send({
          _tta: "176",
          csrf_token: csrf,
          action: "enter",
          usernameOrEmail: "cpduels-bot",
          password: "davidandjeffrey",
        })
        .set("Content-Type", "application/x-www-form-urlencoded");
      let re = /cpduels-bot/gs;
      console.log(await res.text);
      // console.log(`${await res.text.match(re).length} Login Succeeded`);
    } catch (err) {
      console.log(`Login failed: \n ${err}`);
    }
  }

  static async submitProblem(
    contestId,
    problemIndex,
    sourceCode,
    programTypeId
  ) {
    try {
      let resp = await client.get(
        `https://codeforces.com/contest/${contestId}/submit`
      );
      let csrf = await TaskManager.findCsrf(resp.text);
      let submitUrl = `https://codeforces.com/contest/${contestId}/submit?csrf_token=${csrf}`;
      await TaskManager.proxyPost([
        submitUrl,
        {
          csrf_token: csrf,
          action: "submitSolutionFormSubmitted",
          submittedProblemIndex: problemIndex,
          programTypeId: programTypeId,
          contestId: contestId,
          source: sourceCode,
          tabSize: "4",
          _tta: "594",
          sourceCodeConfirmed: "true",
        },
      ]);
      console.log(`Submitted solution for ${contestId}${problemIndex}`);
    } catch (err) {
      console.log(
        `Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`
      );
    }
  }

  static async checkUsername(username) {
    const url = `https://codeforces.com/api/user.info?usernames=${username}`;
    const response = await this.api_response(url);
    if (!response) {
      return [false, "Codeforces API Error"];
    }
    if (response.status === "FAILED") {
      return [false, response.comment];
    }
    return [true, response.result[0]];
  }

  static async checkDuelParams(username, ratingMin, ratingMax) {
    // For validating duel creation request
    let validUsername = await this.checkUsername(username);
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
  }

  static async getUserSubmissions(username) {
    const url = `https://codeforces.com/api/user.status?username=${username}`;
    console.log(url);
    const response = await this.api_response(url);
    if (!response) return [false, "CF API Error"];
    if (response.status !== "OK") return [false, response.comment];
    let data = [];
    try {
      response.result.forEach((submission) => {
        let problem = submission.problem;
        if (!problem.hasOwnProperty("rating")) return;
        if (!submission.hasOwnProperty("verdict")) submission.verdict = null;
        data.push({
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

  static async getUserSubmissionsAfterTime(username, time) {
    const url = `https://codeforces.com/api/user.status?username=${username}`;
    console.log(url);
    let time1 = Date.now();
    const response = await this.api_response(url);
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

  static async getContestList() {
    const url = "https://codeforces.com/api/contest.list";
    const response = await this.api_response(url);
    if (!response) {
      return false;
    }
    return response["result"];
  }

  static async getProblemList() {
    const url = "https://codeforces.com/api/problemset.problems";
    const response = await this.api_response(url);
    if (!response) {
      return false;
    }
    return response["result"]["problems"];
  }

  static async getProblems(filter = {}, fields = {}) {
    // filter for the problems we're looking for
    // fields for the parts of the problems

    let result = await db
      .collection("cfproblems")
      .get(filter, fields)
      .toArray();

    return result;
  }

  static async getProblemsByRating(ratingMin, ratingMax) {
    //{rating: {$gt:ratingMin, $lt:ratingMax}}
    let result = await this.getProblems({
      rating: { $gte: ratingMin, $lte: ratingMax },
    });
    return result;
  }

  static async getProblemsByUsernamesAndRating(
    usernames,
    ratingMin,
    ratingMax
  ) {
    let ratedProblems = await this.getProblems(ratingMin, ratingMax);
    let submissions1 = await this.getUserSubmissions(usernames[0]);
    let submissions2 = await this.getUserSubmissions(usernames[1]);
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

  static async generateProblems(numProblems, usernames, ratingMin, ratingMax) {
    let problems = await this.getProblemsByUsernamesAndRating(
      usernames,
      ratingMin,
      ratingMax
    );
    let problemSet = problems.sort(() => 0.5 - Math.random());
    return problemSet.slice(0, numProblems);
  }
}

export default CodeforcesAPI;
