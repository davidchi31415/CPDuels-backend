import fetch from "node-fetch";
import { sleep } from './helpers.js';

class CodeforcesAPI {
    static async api_response(url, params) {
      try {
        let tries = 0;
        let returnObj;
        while (tries < 5) {
          tries++;
          let responseData = {
            'status':'',
            'comment':''
          };
          await fetch(url, params).then(
            async (res) => {
              if (res.status === 503) { // Limit exceeded error
                responseData.status = "FAILED"; responseData.comment = 'limit exceeded';
                await sleep(1000);
              } else {
                responseData = await res.json();
              }
            }
          );
          if (responseData?.status === "OK") return responseData;
          returnObj = responseData;
        }
        return returnObj; // Return if fail after 5 tries and not limit exceeded
      } catch(e) {
        console.log(e);
        return false;
      }
    }
  
    static async check_handle(handle) {
      const url = `https://codeforces.com/api/user.info?handles=${handle}`;
      const response = await this.api_response(url);
      if (!response) {
        return [false, "Codeforces API Error"];
      }
      if (response.status === "FAILED") {
        return [false, response.comment];
      }
      return [true, response.result[0]];
    }
  
    static async get_user_submissions(handle) {
      const url = `https://codeforces.com/api/user.status?handle=${handle}`;
      console.log(url);
      const response = await this.api_response(url);
      if (!response) return [false, "CF API Error"];
      if (response.status !== 'OK') return [false, response.comment];
      let data = [];
      try {
        response.result.forEach((submission) => {
          let problem = submission.problem;
          if (!problem.hasOwnProperty('rating')) return;
          if (!submission.hasOwnProperty('verdict')) submission.verdict = null;
          data.push({
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            type: problem.type,
            rating: problem.rating,
            creationTimeSeconds: submission.creationTimeSeconds,
            verdict: submission.verdict
          });
        });
      } catch (e) {
        console.log("Getting User Submissions FAILED");
      }
      return data;
    }

    static async getUserSubmissionsAfterTime(handle, time) {
      const url = `https://codeforces.com/api/user.status?handle=${handle}`;
      console.log(url);
      let time1 = Date.now();
      const response = await this.api_response(url);
      console.log(time1 - Date.now());
      if (!response) return [false, "CF API Error"];
      if (response.status !== 'OK') return [false, response.comment];
      let data = [];
      try {
        let time2 = Date.now();
        for (let i = 0; i < response.result.length; i++) {
          let submission = response.result[i];
          if (submission.creationTimeSeconds < time) break;
          if (!submission.hasOwnProperty('verdict')) submission.verdict = null;
          let problem = submission.problem;
          data.push({
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            type: problem.type,
            rating: problem.rating,
            creationTimeSeconds: submission.creationTimeSeconds,
            verdict: submission.verdict
          });
        }
        console.log(Date.now() - time2);
      } catch (e) {
        console.log("Getting User Submissions FAILED: " + e);
      }
      return data;
    }
    
    static async get_contest_list() {
      const url = "https://codeforces.com/api/contest.list";
      const response = await this.api_response(url);
      if (!response) {
        return false;
      }
      return response['result'];
    }
  
    static async get_problem_list() {
      const url = "https://codeforces.com/api/problemset.problems";
      const response = await this.api_response(url);
      if (!response) {
        return false;
      }
      return response['result']['problems'];
    }
  }
  
  export default CodeforcesAPI;