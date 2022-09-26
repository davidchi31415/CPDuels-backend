import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import problemsRouter from './routes/problemsRouter.js';
import DuelManager from './utils/duelManager.js';

const app = express();

const PORT = process.env.PORT || 3030;
const DATABASE_URL = process.env.DATABASE_URL || "mongodb+srv://CPDuels:wrongfulphrasenimblemonumentshindigcardstockvastlyappraisalcloaktremor@cpduels.s78kdcw.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(DATABASE_URL);
const db = mongoose.connection;

let manager;
db.on('error', (err) => console.log(err));
db.once('open', async () => {
    console.log("Connected to database.");
    manager = new DuelManager();
    // await DuelManager.changeDuelState("632bbea40d58880cf56884c9", "ONGOING");
});

app.use(cors({ origin: `https://cpduels.onrender.com` }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/problem', problemsRouter);

app.listen(PORT, () => console.log("Server is started."));

export default db;