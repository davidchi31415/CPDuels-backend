import superagent from 'superagent';
let client = superagent.agent();

class SubmissionManager {

    static async findCsrf(body) {
        let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
        console.log("findCsrf called " + body.match(re)[0]);
        return body.match(re)[0];
    }

    static async login() {
        let resp = await client.get('https://codeforces.com/enter/');
        console.log(resp.status);
    
        let csrf = findCsrf(resp.text);
        await client
            .post('http://codeforces.com/enter/')
            .send({
                _tta: "176",
                csrf_token: csrf,
                action: "enter",
                handleOrEmail: "",
                password: "",
            })
            .set('Content-Type','application/x-www-form-urlencoded')
            .then(res => {
                console.log(res.status);
            })
    }
    
    
    static async submit(contestId,problemIndex,sourceCode) {
        let resp = await client.get(`https://codeforces.com/contest/${contestId}/submit`); 
        console.log(resp.status);
        let csrf = await findCsrf(resp.text);
        let submitUrl = `https://codeforces.com/contest/${contestId}/submit?csrf_token=${csrf}`;
        await client
            .post(submitUrl)
            .send({
                csrf_token:             csrf,
                action:                 "submitSolutionFormSubmitted",
                submittedProblemIndex:  problemIndex,
                programTypeId:          "73",
                contestId:              contestId,
                source:                 sourceCode,
                tabSize:                "4",
                _tta:                   "594",
                sourceCodeConfirmed:    "true",
            })
            .set('Content-Type','application/x-www-form-urlencoded')
            .then(res => {
                console.log(res.status);
            })
    }

}

export default SubmissionManager;