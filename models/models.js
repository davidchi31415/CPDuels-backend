import mongoose, { mongo } from "mongoose";

const cfproblemSchema = mongoose.Schema({
  contestId: {
    type: Number,
    required: true,
  },
  index: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    default: "PROGRAMMING",
  },
  points: {
    type: Number,
  },
  tags: {
    type: [
      {
        type: String,
      },
    ],
    required: false,
  },
  content: {
    type: {},
    required: true,
  },
});

const problemSchema = mongoose.Schema({
  contestId: {
    type: Number,
    required: true,
  },
  index: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    default: "PROGRAMMING",
  },
  points: {
    type: Number,
    required: true,
    default: 0,
  },
  tags: {
    type: [
      {
        type: String,
      },
    ],
    required: false,
  },
  content: {
    type: Object,
    required: true,
  },
  playerScores: {
    type: [
      {
        type: Number,
      },
      {
        type: Number,
      },
    ],
    required: true,
    default: [0, 0],
  },
  playerAttempts: {
    type: [
      {
        type: Number,
      },
      {
        type: Number,
      },
    ],
    required: true,
    default: [0, 0],
  },
});

const playerSchema = mongoose.Schema({
  username: {
    type: String,
    default: "GUEST",
  },
  uid: {
    type: String,
    required: true,
  },
  guest: {
    type: Boolean,
    required: true,
    default: false,
  },
  score: {
    type: Number,
    required: true,
    default: 0,
  },
  solveCount: {
    type: Number,
    required: true,
    default: 0,
  },
  attemptCount: {
    type: Number,
    required: true,
    default: 0,
  },
});

const duelSchema = mongoose.Schema({
  platform: {
    type: String,
    required: true,
  },
  players: {
    type: [playerSchema],
    required: true,
    default: [],
  },
  problems: {
    type: [problemSchema],
    required: true,
    default: [],
  },
  ratingMin: {
    type: Number,
    required: true,
  },
  ratingMax: {
    type: Number,
    required: true,
  },
  problemCount: {
    type: Number,
    required: true,
  },
  timeLimit: {
    type: Number,
    required: true,
  },
  private: {
    type: Boolean,
    required: true,
    default: false,
  },
  status: {
    type: String,
    required: true,
    default: "WAITING", // READY, ONGOING, FINISHED
  },
  result: {
    type: [
      {
        type: String,
        required: true,
        default: "NONE", // DRAW, WON, ABORTED, RESIGNED
      },
      {
        type: String, // Player username of the winner (if duel ended by resignation, still winner)
        required: false,
      },
    ],
  },
  startTime: {
    type: Number,
  },
});

const submissionSchema = mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
    },
		problemName: {
			type: String,
			required: true
		},
    url: {
      type: String,
      required: true,
    },
    duelId: {
      type: String,
      required: true,
    },
    uid: {
      type: String,
      required: true,
    },
    submissionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "PENDING", // WA, AC, RTE
    },
  },
  {
    timestamps: true,
  }
);

const messageSchema = mongoose.Schema({
  timeSubmitted: {
    type: String,
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  type: {
    type: String,
    required: true,
  },
  wantsResponse: {
    type: String,
    required: true,
    default: "NO",
  },
  content: {
    type: String,
    required: true,
  },
});

export const cfproblemModel = mongoose.models.CFProblem
  ? mongoose.model.CFProblem
  : mongoose.model("CFProblem", cfproblemSchema);
export const playerModel = mongoose.models.playerModel
  ? mongoose.models.playerModel
  : mongoose.model("Player", playerSchema);
const duelModel = mongoose.models.duelModel
  ? mongoose.models.duelModel
  : mongoose.model("Duel", duelSchema);
export const submissionModel = mongoose.models.submissionModel
  ? mongoose.models.submissionModel
  : mongoose.model("Submission", submissionSchema);
export const messageModel = mongoose.models.messageModel
  ? mongoose.models.messageModel
  : mongoose.model("Message", messageSchema);

export default duelModel;
