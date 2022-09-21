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
  }
});

const problemModel = mongoose.models.Problem ? mongoose.model.Problem : mongoose.model('Problem', problemSchema);

export default problemModel;