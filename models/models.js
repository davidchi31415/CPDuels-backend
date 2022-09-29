import mongoose from 'mongoose';

const problemSchema = mongoose.Schema({
  contestId: {
    type: Number,
    required: true
  },
  index: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    default: "PROGRAMMING"
  },
  points: {
    type: Number,
    required: true
  },
  tags: {
    type: [{
      type: String
    }],
    required: false
  },
  playerOneScore: {
    type: Number,
    required: true,
    default: 0
  },
  playerTwoScore: {
    type: Number,
    required: true,
    default: 0
  }
});

const playerSchema = mongoose.Schema({
  handle: {
    type: String,
    required: true,
    default: "Guest"
  }
});

const duelSchema = mongoose.Schema({
  players: {
    type: [playerSchema],
    required: true,
    default: []
  },
  problems: {
    type: [problemSchema],
    required: true,
    default: []
  },
  ratingMin: {
    type: Number,
    required: true
  },
  ratingMax: {
    type: Number,
    required: true
  },
  problemCount: {
    type: Number,
    required: true,
    default: 5
  },
  timeLimit: {
    type: Number,
    required: true,
    default: 30
  },
  private: {
    type: Boolean,
    required: true,
    default: false
  },
  status: {
    type: String,
    required: true,
    default: "WAITING" // ONGOING, FINISHED
  },
  playerOneScore: {
    type: Number,
    required: true,
    default: 0
  },
  playerTwoScore: {
    type: Number,
    required: true,
    default: 0
  },
  result: {
    type: [{
      type: String,
      required: true,
      default: "NONE" // DRAW, WON
    }, {
      type: String, // Player handle of the winner
      required: false,
    }]
  }
});

export const problemModel = mongoose.models.Problem ? mongoose.model.Problem : mongoose.model('Problem', problemSchema);
export const playerModel = mongoose.models.playerModel ? mongoose.models.playerModel : mongoose.model('Player', playerSchema);
const duelModel = mongoose.models.duelModel ? mongoose.models.duelModel : mongoose.model('Duel', duelSchema);

export default duelModel;
