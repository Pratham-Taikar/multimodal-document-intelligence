const Subject = require('../models/Subject');
const { generateMCQs, generateShortAnswer } = require('../services/questionService');

exports.generateMCQs = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (subject.notes.length === 0) {
      return res.status(400).json({ 
        message: 'Please upload notes before generating questions' 
      });
    }

    const result = await generateMCQs(subjectId, userId, subject.name);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);

  } catch (error) {
    console.error('MCQ generation error:', error);
    res.status(500).json({ message: 'Error generating MCQs' });
  }
};

exports.generateShortAnswer = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (subject.notes.length === 0) {
      return res.status(400).json({ 
        message: 'Please upload notes before generating questions' 
      });
    }

    const result = await generateShortAnswer(subjectId, userId, subject.name);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json(result);

  } catch (error) {
    console.error('Short answer generation error:', error);
    res.status(500).json({ message: 'Error generating short answers' });
  }
};

module.exports = exports;
