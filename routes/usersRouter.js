import express from 'express';
import userModel from '../models/userModel.js';

const usersRouter = express.Router();

// GET all users
usersRouter.get('/', async (req, res) => {
  try {
    const users = await userModel.find();
    res.send(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one user
usersRouter.get('/:id', getUser, (req, res) => {
  res.send(res.user);
});

// POST one user
usersRouter.post('/add', async (req, res) => {
  const user = new userModel(req.body);
  try {
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH one user
usersRouter.get('/:id', getUser, (req, res) => {

});

// DELETE one user
usersRouter.delete('/:id', getUser, async (req, res) => {
  try {
    await res.user.delete();
    res.json({ message: "User deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE all users
usersRouter.delete('/', async (req, res) => {
  try {
    await userModel.deleteMany();
    res.json({ message: "All users deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
})

async function getUser(req, res, next) {
  let user;
  try {
    user = await userModel.findById(req.params.id);
    // Check for error and immediately return to avoid setting res.subscriber
    if (user == null) return res.status(404).json({ message: "User not found." });
  } catch (err) {
    // Immediately return in case of error to avoid setting res.subscriber
    return res.status(500).json({ message: err.message });
  }
  
  res.user = user;
  next(); 
}

export default usersRouter;