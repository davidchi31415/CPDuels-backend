import DEBUG from './debug.js';

const allowedOrigins = DEBUG ? ['http://localhost:3000'] : ['https://www.cpduels.com:*'];

export default allowedOrigins;