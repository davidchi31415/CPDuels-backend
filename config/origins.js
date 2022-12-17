import DEBUG from './debug.js';

const allowedOrigins = DEBUG ? 'http://localhost:3000' : 'https://www.cpduels.com';
const headless = DEBUG ? false : true;

const corsOptions = {
    origin: allowedOrigins,
    optionsSuccessStatus: 200,
};

export default corsOptions;
export { allowedOrigins, headless };