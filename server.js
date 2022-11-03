import express from "express";
import mongoose from "mongoose";
import duelsRouter from "./routes/duelsRouter.js";
import cfproblemsRouter from "./routes/cfproblemsRouter.js";
import { Server } from "socket.io";
import allowedOrigins from "./config/origins.js";
import { sleep } from "./utils/helpers/sleep.js";
import cors from "cors";
import SocketManager from "./managers/SocketManager.js";
import CodeforcesAPI from "./utils/api/CodeforcesAPI.js";
import DuelManager from "./managers/DuelManager.js";
import TaskManager from "./managers/TaskManager.js";

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

const socketManager = new SocketManager(io);

// let api = new CodeforcesAPI();

// let q = new Queue();

// let a = [
// 	"submit",
// 	{
// 		contestId: 1729,
// 		problemIndex: "f",
// 		sourceCode: "thisis a new sub",
// 		programTypeId: 7,
// 		duelId: "634afc17d129402bba111111",
// 		playerNum: 2,
// 	},
// ];
// q.enqueue(a);
// console.log(q);
// const codeforcesAPI = new CodeforcesAPI();
// const taskManager = new TaskManager(codeforcesAPI);
// taskManager.init();
// const duelManager = new DuelManager(codeforcesAPI, taskManager);

// setInterval(async function () {
// 	let duel = await duelManager.getDuel("6364245cc794c96fbd0dd096");
// 	console.log(duel);
// 	// console.log(taskManager.wProx);
// 	// while (taskManager.wProx.length == 0) {
// 	// 	await sleep(1000);
// 	// }
// 	// await api.updateSubmissions();
// 	// await api.updateSubmissionStatus("6359d9fbdca5b34c3617bf7a", "ACCEPT");
// 	// let check = await taskManager.get("https://codeforces.com/enter/");
// 	// console.log(check.text.match("unavailable.")[0]);
// 	// await api.login();
// 	// await api.submitProblem(1729, "f", "this is anewsubmision2", 7, "634afc17d129402bba100000", 2);
// 	// await api.submitProblem(1729, "f", "thisforsureanewSUbmisions2", 7, "634afc17d129402bba111111", 2);
// 	// console.log(await api.getUserSubmissions("cpduels-bot"));
// 	// await api.getSubmissionById(177820677, 1729);
// 	// console.log(await api.getUserSubmissions("cpduels-bot"));
// 	// console.log(await api.updateSubmissions());
// 	// await db.collection("submissions").insertOne(ss);
// }, 10000);

export default db;
