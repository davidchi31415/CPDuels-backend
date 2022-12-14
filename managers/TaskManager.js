import duelModel from "../models/models.js";
import Queue from "../utils/helpers/queue.js";
import DuelManager from "./DuelManager.js";

class TaskManager {
  constructor(codeforcesAPI, leetcodeAPI) {
    this.queue = new Queue();
    this.codeforcesAPI = codeforcesAPI;
    this.leetcodeAPI = leetcodeAPI;
  }
  async init() {
    const checker = async function () {
      console.log(this.queue);
      if (this.queue.size()) {
        let obj = this.queue.dequeue();
        if (obj[0] == "submit") {
          await this.submitProblem(obj[1].duel, obj[1].uid, obj[1].submission);
        }
      }
    };

    setInterval(checker.bind(this), 1000);
    // while (true) {
    // 	await this.codeforcesAPI.updateSubmissions();
    // }
  }

  // async updateProblemsets() {
  // 	await this.codeforcesAPI.updateProblemsInDatabase();
  // 	// await this.atcoderAPI.updateProblemsInDatabase();
  // 	// await this.leetcodeAPI.updateProblemsInDatabase();
  // }

  /*
   async isValidSubmitRequest(duel, uid, submission) {}
  */

  calculateProblemPoints(platform, problemRating, duelRatingMin) {
    if (platform === "CF") {
      // base is 500 points, add however many points over the rating min of duel
      return problemRating - duelRatingMin + 500;
    } else if (platform === "AT") {
    } else {
      // base is 500 points, add 300 points per level above
      return 500 + (problemRating - duelRatingMin) * 300
    }
  }

  async createDuelProblems(duel) {
    let problems;
    if (duel.platform === "CF") {
      problems = await this.codeforcesAPI.generateProblems(
        duel.problemCount,
        duel.ratingMin,
        duel.ratingMax
      );
      for (let i = 0; i < problems.length; i++) {
        problems[i] = {
          ...problems[i],
          platform: duel.platform,
          accessor: {
            contestId: problems[i].contestId,
            index: problems[i].index,
          },
          duelPoints: this.calculateProblemPoints(
            duel.platform,
            problems[i].rating,
            duel.ratingMin
          ),
        };
      }
    } else if (duel.platform === "AT") {
      // problems = await AtcoderAPI.generateProblems(duel.problemCount, usernames, duel.ratingMin, duel.ratingMax);
    } else if (duel.platform === "LC") {
      problems = await this.leetcodeAPI.generateProblems(
        duel.problemCount,
        duel.ratingMin,
        duel.ratingMax
      );
      for (let i = 0; i < problems.length; i++) {
        problems[i] = {
          ...problems[i],
          platform: duel.platform,
          name: problems[i].name,
          accessor: {
            slug: problems[i].slug,
          },
          duelPoints: this.calculateProblemPoints(
            duel.platform,
            problems[i].rating,
            duel.ratingMin
          ),
        };
      }
    } else {
      // Error
    }
    return problems;
  }

  async regenerateProblems(duel, unwantedProblemIndices) {
    console.log("Regenerating Problems");
    await duelModel.findOneAndUpdate(
      { _id: duel._id },
      {
        $set: {
          regeneratingProblems: true,
        },
      }
    );
    try {
      let unwantedProblems = [];
      unwantedProblemIndices.forEach((index) => {
        unwantedProblems.push(duel.problems[index]);
      });
      let newProblems;
      if (duel.platform === "CF") {
        newProblems = await this.codeforcesAPI.regenerateProblems(
          duel.problemCount,
          unwantedProblems,
          unwantedProblemIndices,
          duel.ratingMin,
          duel.ratingMax
        );
        for (let i = 0; i < newProblems.length; i++) {
          newProblems[i] = {
            ...newProblems[i],
            duelPoints: this.calculateProblemPoints(
              duel.platform,
              newProblems[i].rating,
              duel.ratingMin
            ),
          };
        }
      } else if (platform === "AT") {
        // problems = await AtcoderAPI.generateProblems(duel.problemCount, usernames, duel.ratingMin, duel.ratingMax);
      } else if (platform === "LC") {
        newProblems = await this.leetcodeAPI.regenerateProblems(
          duel.problemCount,
          unwantedProblems,
          unwantedProblemIndices,
          duel.ratingMin,
          duel.ratingMax
        );
        for (let i = 0; i < newProblems.length; i++) {
          newProblems[i] = {
            ...newProblems[i],
            duelPoints: this.calculateProblemPoints(
              duel.platform,
              newProblems[i].difficulty,
              duel.ratingMin
            ),
          };
        }
      } else {
        // Error
      }
      for (let i = 0; i < unwantedProblemIndices.length; i++) {
        let setting = `problems.${unwantedProblemIndices[i]}`;
        await duelModel.findOneAndUpdate(
          { _id: duel._id },
          {
            $set: {
              [setting]: newProblems[i],
            },
          }
        );
      }
      await duelModel.findOneAndUpdate(
        { _id: duel._id },
        {
          $set: {
            regeneratingProblems: false,
          },
        }
      );
    } catch (e) {
      await duelModel.findOneAndUpdate(
        { _id: duel._id },
        {
          $set: {
            regeneratingProblems: false,
          },
        }
      );
    }
  }
}

export default TaskManager;
