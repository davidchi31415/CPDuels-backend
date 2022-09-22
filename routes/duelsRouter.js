import express from 'express';
import duelModel from '../models/duelModel.js';

const duelsRouter = express.Router();

// GET all duels
duelsRouter.get('/', async (req, res) => {
  try {
    const duels = await duelModel.find();
    res.send(duels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one duel
duelsRouter.get('/:id', getDuel, (req, res) => {
  res.send(res.duel);
});

// POST one duel
duelsRouter.post('/add', async (req, res) => {
  const duel = new duelModel(req.body);
  try {
    const newDuel = await duel.save();
    res.status(201).json(newDuel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH one duel
duelsRouter.patch('/:id', getDuel, async (req, res) => {
  if (req.body.status != null) {
    res.duel.status = req.body.status;
  }
  try {
    const updatedDuel = await res.duel.save();
    res.json(updatedDuel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE one duel
duelsRouter.delete('/:id', getDuel, async (req, res) => {
  try {
    await res.duel.delete();
    res.json({ message: "Duel deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE all duels
duelsRouter.delete('/', async (req, res) => {
  try {
    await duelModel.deleteMany();
    res.json({ message: "All duels deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
})

async function getDuel(req, res, next) {
  let duel;
  try {
    duel = await duelModel.findById(req.params.id);
    // Check for error and immediately return to avoid setting res.subscriber
    if (duel == null) return res.status(404).json({ message: "Duel not found." });
  } catch (err) {
    // Immediately return in case of error to avoid setting res.subscriber
    return res.status(500).json({ message: err.message });
  }
  
  res.duel = duel;
  next(); 
}

export default duelsRouter;