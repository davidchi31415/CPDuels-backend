import superagent from 'superagent';
let client = superagent.agent();

class SubmissionManager {

    static async getProxies() {
        let proxyLinks = ["https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt","https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt","https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt"];
        let proxies = [];
        for (const link of proxyLinks) {
            let resp = await client.get(link);
            let p = resp.text.split('\n');
            proxies.push(...p);
        }
        return proxies;
    }
    
    static async getWorkingProxies(timeout) {
        let proxies = await getProxies();
        let workingProxies = [];
        await Promise.all(
        proxies.map(async (proxy) => {
            try {
                let split = proxy.split(':');
                let urlProxy = `http://${proxy}`;
                let response = await client.get('https://httpbin.org/ip?json')
                                    .proxy(urlProxy)
                                    .timeout(timeout);
                const body = JSON.parse(await response.text);
                workingProxies.push(`${body.origin}:${split[1]}`);
                return body;
            } catch {}
        })
        );
        return workingProxies;
    };

    static async getRandomWorkingProxyURL(timeout) {
        try {
            let workingProxies = await getWorkingProxies(timeout);
            while (workingProxies.length == 0) {
                timeout += 200;
                workingProxies = await getWorkingProxies(timeout);
            }
            return `http://${workingProxies[Math.floor(Math.random()*workingProxies.length)]}`;
        } catch {}
        return '';
    }

    static async findCsrf(body) {
        let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
        return body.match(re)[0];
    }

    static async login() {
        try {
            let resp = await client.get('https://codeforces.com/enter/');        
            let csrf = await this.findCsrf(resp.text);
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
                .then(res => {console.log(`Login Succeeded ${res.status}`)});
        } catch (err) {
            console.log(`Login failed: \n ${err}`);
        }
    }
    
    
    static async submit(contestId,problemIndex,sourceCode) {
        try {
            let resp = await client.get(`https://codeforces.com/contest/${contestId}/submit`);
            let csrf = await this.findCsrf(resp.text);
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
                .then(console.log(`Submitted solution for ${contestId}${problemIndex}`));
        } catch (err) {
            console.log(`Submitting solution for ${contestId}${problemIndex} Failed: \n ${err}`);
        }
    }

}

export default SubmissionManager;