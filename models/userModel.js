import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
  handle: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true
  }, 
  rank: {
    type: String,
    required: true
  }
});

const userModel = mongoose.models.User ? mongoose.models.User : mongoose.model('User', userSchema);

export default userModel;