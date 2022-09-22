import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import DuelManager from './utils/duelManager.js';

// ENVIRONMENT VARIABLES
import dotenv from 'dotenv';
dotenv.config();

const app = express();

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

let manager;
db.on('error', (err) => console.log(err));
db.once('open', async () => {
    console.log("Connected to database.");
    manager = new DuelManager();
    await DuelManager.changeDuelState("632bbea40d58880cf56884c9", "ONGOING");
});

app.use(cors({ origin: `http://localhost:3000` }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

app.listen(process.env.BACKEND_PORT, () => console.log("Server is started."));

export default db;