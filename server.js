import express from "express";
import mongoose from "mongoose";
import duelsRouter from "./routes/duelsRouter.js";
import cfproblemsRouter from "./routes/cfproblemsRouter.js";
import { Server } from "socket.io";
import allowedOrigins from "./config/origins.js";
import { sleep } from "./utils/helpers/sleep.js";
import cors from "cors";
import TaskManager from "./managers/TaskManager.js";
import SocketManager from "./managers/SocketManager.js";
import DuelManager from "./managers/DuelManager.js";

const app = express();
var corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
const PORT = process.env.PORT || 8080;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "mongodb+srv://CPDuels:wrongfulphrasenimblemonumentshindigcardstockvastlyappraisalcloaktremor@cpduels.s78kdcw.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(DATABASE_URL);
const db = mongoose.connection;
db.on("error", (err) => console.log(err));
db.once("open", async () => console.log("Connected to database."));
while (mongoose.connection.readyState != 1) {
	await sleep(1000);
}

// setInterval(async function () {
//   console.log(wProx);
//   while (wProx.length == 0) {
//     await sleep(1000);
//   }
//   await CodeforcesAPI.login();
//   //   await CodeforcesAPI.submitProblem(1729, "f", "frfraasdfsdf", 73);
// }, 10000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/duels", duelsRouter);
app.use("/cfproblems", cfproblemsRouter);
const server = app.listen(PORT, () =>
  console.log(`Server is started on port ${PORT}.`)
);
const io = new Server(
  server,
  cors({
    origin: allowedOrigins,
  })
);

const taskManager = new TaskManager();
await taskManager.init();
const socketManager = new SocketManager(io);
const duelManager = new DuelManager(taskManager, socketManager);

export default db;