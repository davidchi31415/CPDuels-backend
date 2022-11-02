import DEBUG from './debug.js';

const allowedOrigins = DEBUG ? 'http://localhost:3000' : 'https://cpduels.com';

export default allowedOrigins;