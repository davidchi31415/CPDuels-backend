import superagent from 'superagent';
let client = superagent.agent();

class CodeforcesScraper {

    static async findProblemConstraints(body, contestId, index) {
      let re = /<div class="time-limit">(.*?)<p>/;
      try {
        let raw = body.match(re)[0];
        return raw.substring(0, raw.length-3);
      } catch (e) {
        console.log(`Couldn't fetch problem ${contestId}${index} constraints: ` + e);
      }
    }

    static async findProblemStatement(body, contestId, index) {
        let re1 = /<div class="problem-statement">(.*?)<div class="input-specification">/;
        try {
          let totalProblemStatement = body.match(re1)[0];
          let re2 = /<p>(.*?)<\/div><div class="input-specification">/;
          let problemStatement = totalProblemStatement.match(re2)[1];
          problemStatement = problemStatement.replace(/\$\$\$\$\$\$(.*?)\$\$\$\$\$\$/g, "\\[$1\\]");
          problemStatement = problemStatement.replace(/\$\$\$(.*?)\$\$\$/g, "\\($1\\)");
          return problemStatement;
        } catch (e) {
          console.log(`Couldn't fetch problem ${contestId}${index} statement: ` + e);
        }
    }

    static async findProblemInput(body, contestId, index) {
      let re = /<div class="input-specification"><div class="section-title">Input<\/div>(.*?)<\/div><div class="output-specification">/;
      try {
        return body.match(re)[1];
      } catch (e) {
        console.log(`Couldn't fetch problem ${contestId}${index} input: ` + e);
      }
    }

    static async findProblemOutput(body, contestId, index) {
      let re = /<div class="output-specification"><div class="section-title">Output<\/div>(.*?)<\/div><div class="sample-tests">/;
      try {
        return body.match(re)[1];
      } catch (e) {
        console.log(`Couldn't fetch problem ${contestId}${index} input: ` + e);
      }
    }

    static async getProblemContent(contestId, index) {
      const sleep = ms => new Promise(
        resolve => setTimeout(resolve, ms)
      );
      let resp;
      try {
        resp = await client.get(`https://codeforces.com/problemset/problem/${contestId}/${index}`);
      } catch (e) {
        console.log(`Couldn't fetch problem ${contestId}${index}, will retry: ` + e);
      }
      while (!resp.ok) {
        await sleep(100);
        try {
          resp = await client.get(`https://codeforces.com/problemset/problem/${contestId}/${index}`);
        } catch (e) {
          console.log(`Couldn't fetch problem ${contestId}${index}, will retry: ` + e);
        }
      }
      try {
        // translate Codeforces's inline and display equation delimiters to something MathJax understands
        let texFilteredResp = resp.text.replace(/\$\$\$\$\$\$(.*?)\$\$\$\$\$\$/g, "\\[$1\\]");
        texFilteredResp = texFilteredResp.replace(/\$\$\$(.*?)\$\$\$/g, "\\($1\\)");
        let problemConstraints = await this.findProblemConstraints(texFilteredResp, contestId, index);
        let problemStatement = await this.findProblemStatement(texFilteredResp, contestId, index);
        let problemInput = await this.findProblemInput(texFilteredResp, contestId, index);
        let problemOutput = await this.findProblemOutput(texFilteredResp, contestId, index);
        if (!problemConstraints || !problemStatement || !problemInput || !problemOutput) return false;
        return {
          problemConstraints: problemConstraints,
          problemStatement: problemStatement,
          problemInput: problemInput,
          problemOutput: problemOutput
        };
      } catch (e) {
        console.log(`Couldn't fetch problem ${contestId}${index} content: ` + e);
      }
    }

}

export default CodeforcesScraper;