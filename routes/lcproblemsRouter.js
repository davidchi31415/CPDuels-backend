import express from 'express';
import { lcproblemModel } from '../models/models.js';

const lcproblemsRouter = express.Router();

// GET all problems
lcproblemsRouter.get('/', async (req, res) => {
  try {
    const problems = await lcproblemModel.find();
    res.send(problems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one problem
lcproblemsRouter.get('/:id', getProblem, (req, res) => {
  res.send(res.problem);
});

// POST one problem
lcproblemsRouter.post('/add', async (req, res) => {
  const problem = new lcproblemModel(req.body);
  try {
    const newProblem = await problem.save();
    res.status(201).json(newProblem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH one problem
lcproblemsRouter.get('/:id', getProblem, (req, res) => {

});

// // DELETE one problem
// lcproblemsRouter.delete('/:id', getProblem, async (req, res) => {
//   try {
//     await res.problem.delete();
//     res.json({ message: "Problem deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // DELETE all problems
// lcproblemsRouter.delete('/', async (req, res) => {
//   try {
//     await lcproblemModel.deleteMany();
//     res.json({ message: "All problems deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// })

async function getProblem(req, res, next) {
  let problem;
  try {
    problem = await lcproblemModel.findById(req.params.id);
    // Check for error and immediately return to avoid setting res.subscriber
    if (problem == null) return res.status(404).json({ message: "Problem not found." });
  } catch (err) {
    // Immediately return in case of error to avoid setting res.subscriber
    return res.status(500).json({ message: err.message });
  }
  
  res.problem = problem;
  next(); 
}

export default lcproblemsRouter;