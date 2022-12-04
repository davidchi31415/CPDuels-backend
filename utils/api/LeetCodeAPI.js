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
      .collection("lcproblems")
      .find(filter, fields)
      .toArray();

    return result;
  }

  static async getRatedProblems(ratingMin, ratingMax, unwantedProblems) {
    const projection = {
      name: 1,
      slug: 1,
      difficulty: 1,
      _id: 1,
    };
    let ratedProblems = await LeetcodeAPI.getDBProblems(
      {
        difficulty: { $gte: ratingMin, $lte: ratingMax },
      },
      projection
    );
    ratedProblems = ratedProblems.map((problem) => {
      problem.databaseId = problem._id;
      delete problem._id;
      return problem;
    });
    if (unwantedProblems?.length) {
      ratedProblems = ratedProblems.filter((problem) => {
        return !unwantedProblems.some((f) => {
          return f.slug === problem.slug;
        });
      });
    }
    let prioritizedProblems = ratedProblems.sort((a, b) => {
      // Sort in ascending order of rating
      if (a.difficulty < b.difficulty) {
        return -1;
      } else if (a.difficulty === b.difficulty) {
        return 0;
      }
      return 1;
    });
    return prioritizedProblems;
  }

  getRandomIndex(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    let indexOverMin = Math.floor(Math.random() * (max - min)); // [0, max-min) because we don't want to include the last index
    let returnIndex = indexOverMin + min; // Get amount over min to index
    return returnIndex;
  }

  async generateProblems(numProblems, ratingMin, ratingMax) {
    let problems = await LeetcodeAPI.getRatedProblems(ratingMin, ratingMax);
    let problemSet = [];
    for (let i = 0; i < numProblems; i++) {
      // Divide into sections, since this is sorted by rating, then find random position in each section
      let index = this.getRandomIndex(
        (i * problems.length) / numProblems,
        ((i + 1) * problems.length) / numProblems
      );
      problemSet.push(problems[index]);
    }
    return problemSet;
  }

  async regenerateProblems( // takes in array of old problems and generates new ones
    unwantedProblems,
    oldProblems,
    ratingMin,
    ratingMax
  ) {
    let problems = await LeetcodeAPI.getRatedProblems(
      ratingMin,
      ratingMax,
      unwantedProblems
    );
    let newProblems = [];
    for (let i = 0; i < oldProblems.length; i++) {
      // Divide into sections, since this is sorted by rating, then find random position in each section
      let index = this.getRandomIndex(
        (i * problems.length) / oldProblems.length,
        ((i + 1) * problems.length) / oldProblems.length
      );
      newProblems.push(problems[index]);
    }
    return newProblems;
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
				console.log(`Couldn't get problem preview for ${filteredProblems[i].slug}`);
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
