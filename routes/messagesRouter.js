import express from "express";
import { messageModel } from "../models/models.js";

const messagesRouter = express.Router();

// GET all messages
messagesRouter.get("/", async (req, res) => {
  try {
    const messages = await messageModel.find();
    res.send(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET one message
messagesRouter.get("/:id", getMessage, (req, res) => {
  res.send(res.message);
});

// POST one message
messagesRouter.post("/add", async (req, res) => {
  const message = new messageModel(req.body);
  console.log(req.body);
  let validMessage = req.body.content != "" && req.body.content.length <= 500;
  try {
    if (validMessage) {
      const newMessage = await message.save();
      res.status(201).json(newMessage);
    } else {
      res.status(400).json({ message: "Message either too short or too long." });
    }
  } catch (err) {
    console.log(err.message);
    res.status(400).json({ message: err.message });
  }
});

// // DELETE one message
// messagesRouter.delete("/:id", getMessage, async (req, res) => {
//   try {
//     await res.message.delete();
//     res.json({ message: "Message deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // DELETE all messages
// messagesRouter.delete("/", async (req, res) => {
//   try {
//     await messageModel.deleteMany();
//     res.json({ message: "All messages deleted." });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

async function getMessage(req, res, next) {
  let message;
  try {
    message = await messageModel.findById(req.params.id);
    // Check for error and immediately return to avoid setting res.subscriber
    if (message == null)
      return res.status(404).json({ message: "Message not found." });
  } catch (err) {
    // Immediately return in case of error to avoid setting res.subscriber
    return res.status(500).json({ message: err.message });
  }

  res.message = message;
  next();
}

export default messagesRouter;
