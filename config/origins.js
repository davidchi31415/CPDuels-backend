import DEBUG from './debug.js';

const allowedOrigins = DEBUG ? ['http://localhost:3000'] : ['https://cpduels.onrender.com:*', 'https://www.cpduels.com:*'];

export default allowedOrigins;