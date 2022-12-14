import superagent from "superagent";
import { sleep } from "../helpers/sleep.js";
import fetch from "node-fetch";
import ql from "superagent-graphql";
import db from "../../server.js";
class LeetcodeAPI {
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
    console.log(numProblems, numBins);
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
    console.log(problems);
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
