import superagent from "superagent";

const client = superagent.agent();

export function findCsrf(body) {
    let re = /csrftoken=([\s\S]*?);/;
    return body.match(re)[1];
}
