export function findCsrf(body) {
    let re = /(?<="X-Csrf-Token" content=")((.*?)(?=")|(?="))/gs;
    return body.match(re)[0];
}