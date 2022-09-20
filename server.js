import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import duelsRouter from './routes/duelsRouter.js';
import usersRouter from './routes/usersRouter.js';
import problemsRouter from './routes/problemsRouter.js';

// ENVIRONMENT VARIABLES
import dotenv from 'dotenv';

dotenv.config();

const app = express();

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

db.on('error', (err) => console.log(err));
db.once('open', () => console.log("Connected to database."));

app.use(cors({ origin: `http://localhost:${process.env.CLIENT_PORT}` }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/duel', duelsRouter);
app.use('/user', usersRouter)
app.use('/problem', problemsRouter)

app.listen(process.env.BACKEND_PORT, () => console.log("Server is started."));