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

new SocketManager(io);

// const api = new CodeforcesAPI();
// setInterval(async () => {
//   await api.updateSubmissions();
// }, 10000);
// for (let i = 0; i < 20; i++) {
//   await api.puppeteerSubmitProblem(
//     1729,
//     "f",
//     `Random code: ${Date.now()}`,
//     73,
//     "123",
//     "321"
//   );
// }
