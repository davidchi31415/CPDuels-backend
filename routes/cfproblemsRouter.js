import express from 'express';
import { cfproblemModel } from '../models/models.js';

const cfproblemsRouter = express.Router();

// GET all problems
cfproblemsRouter.get('/', async (req, res) => {
  try {
    const problems = await cfproblemModel.find();
    res.send(problems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one problem
cfproblemsRouter.get('/:id', getProblem, (req, res) => {
  res.send(res.problem);
});

// POST one problem
cfproblemsRouter.post('/add', async (req, res) => {
  const problem = new cfproblemModel(req.body);
  try {
    const newProblem = await problem.save();
    res.status(201).json(newProblem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH one problem
cfproblemsRouter.get('/:id', getProblem, (req, res) => {

});

// // DELETE one problem
// cfproblemsRouter.delete('/:id', getProblem, async (req, res) => {
//   try {
//     await res.problem.delete();
//     res.json({ message: "Problem deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // DELETE all problems
// cfproblemsRouter.delete('/', async (req, res) => {
//   try {
//     await cfproblemModel.deleteMany();
//     res.json({ message: "All problems deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// })

async function getProblem(req, res, next) {
  let problem;
  try {
    problem = await cfproblemModel.findById(req.params.id);
    // Check for error and immediately return to avoid setting res.subscriber
    if (problem == null) return res.status(404).json({ message: "Problem not found." });
  } catch (err) {
    // Immediately return in case of error to avoid setting res.subscriber
    return res.status(500).json({ message: err.message });
  }
  
  res.problem = problem;
  next(); 
}

export default cfproblemsRouter;