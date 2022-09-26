import mongoose from 'mongoose';

const duelSchema = mongoose.Schema({
  players: {
    type: [{
      type: String
    }],
    required: true,
    default: ["Guest", "Guest"]
  },
  scores: {
    type: [{
      type: Number
    }],
    required: true,
    default: [0, 0]
  },
  problems: {
    type: [{
      type: String // id for problem - lookup in database
    }],
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
  problems: {
    type: [],
    required: true,
    default: []
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

const duelModel = mongoose.models.duelModel ? mongoose.models.duelModel : mongoose.model('Duel', duelSchema);

export default duelModel;