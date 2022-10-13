import DEBUG from './debug.js';

const allowedOrigins = DEBUG ? 'http://localhost:3000' : 'https://cpduels-backend-production.up.railway.app';

export default allowedOrigins;