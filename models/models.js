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
  rating: {
    type: Number,
    required: true,
    index: true,
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

const cfproblemAccessorSchema = mongoose.Schema({
	databaseId: {
		type: String,
		required: true
	},
	name: {
		type: String,
		required: true
	},
  contestId: {
    type: Number,
    required: true,
  },
  index: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    index: true,
  },
});

const lcproblemSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
  },
  difficulty: {
    type: Number,
    requried: true,
    index: true,
  },
  content: {
    type: {},
    required: true,
  },
  likesDislikes: {
    type: [],
  },
});

const lcproblemAccessorSchema = mongoose.Schema({
	databaseId: {
		type: String,
		required: true
	},
	name: {
		type: String,
		required: true,
	},
  slug: {
    type: String,
    required: true,
  },
  difficulty: {
    type: Number,
    required: true,
    index: true,
  },
});

const problemSchema = mongoose.Schema({
  platform: {
    type: String,
    required: true,
  },
  accessor: {
    type: Object,
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
  rating: {
    type: Number,
    required: true,
  },
  duelPoints: {
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
  databaseId: {
    type: String, // for retreiving problem content
    required: true,
  },
  playerSolveTimes: {
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
  ready: {
    type: Boolean,
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
  regeneratingProblems: {
    type: Boolean,
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
      required: true,
    },
    problemNumber: {
      type: Number,
      required: true,
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
      type: [
        {
          type: String,
          required: true,
        },
        {
          type: Number,
          required: false,
        },
      ],
      required: true,
      default: ["PENDING"], // WA, AC, RTE
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
export const cfproblemAccessorModel = mongoose.models.CFProblemAccessor
  ? mongoose.model.CFProblemAccessor
  : mongoose.model("CFProblemAccessor", cfproblemAccessorSchema);
export const lcproblemModel = mongoose.models.LCProblem
  ? mongoose.model.LCProblem
  : mongoose.model("LCProblem", lcproblemSchema);
export const lcproblemAccessorModel = mongoose.models.LCProblemAccessor
  ? mongoose.model.LCProblemAccessor
  : mongoose.model("LCProblemAccessor", lcproblemAccessorSchema);
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
