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
import submissionsRouter from "./routes/submissionsRouter.js";
import messagesRouter from "./routes/messagesRouter.js";
import LeetcodeAPI from "./utils/api/LeetCodeAPI.js";
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
app.use("/submissions", submissionsRouter);
app.use("/messages", messagesRouter);
const server = app.listen(PORT, () =>
	console.log(`Server is started on port ${PORT}.`)
);
const io = new Server(
	server,
	cors({
		origin: allowedOrigins,
	})
);
export default db;

// const socketManager = new SocketManager(io); // Really, the server manager
// await socketManager.init();
const api = new LeetcodeAPI();
await api.updateProblemsInDatabase();
// console.log(await api.getProblem("reverse-odd-levels-of-binary-tree"));
// let problems = await api.getProblemList();
// console.log(problems);

// await api.updateProblemsInDatabase();
// console.log(await leetcode.user("username"));
// const api = new CodeforcesAPI();
// await api.updateProblemsInDatabase();

// const api = new CodeforcesAPI();
// // await api.updateProblemsInDatabase();
// setInterval(async () => {
// 	await api.updateSubmissions();
// }, 10000);
// let i = 0;
// while (true) {
// 	console.log(`attempt ${i}`);
// 	await api.puppeteerSubmitProblem(
// 		1729,
// 		"f",
// 		"Bullshit name",
// 		3,
// 		`Random code: ${Date.now()}`,
// 		73,
// 		"123",
// 		"321"
// 	);
// 	i++;
// }
