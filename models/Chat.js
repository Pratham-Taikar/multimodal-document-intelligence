const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    citations: [{ filename: String, page: String, snippet: String }],
    confidence: { type: String, enum: ['High', 'Medium', 'Low'] },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema);
