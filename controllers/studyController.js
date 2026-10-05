const Subject = require('../models/Subject');
const { generateSummary } = require('../services/summaryService');
const { generateFlashcards } = require('../services/flashcardService');
const { analyzeResearchPaper } = require('../services/researchPaperService');

exports.createSummary = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { type } = req.body;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (!subject.notes || subject.notes.length === 0) {
      return res.status(400).json({ message: 'Please upload notes first to generate a summary.' });
    }

    const result = await generateSummary(subjectId, userId, type || 'medium');
    if (result.error) return res.status(400).json({ message: result.error });

    res.json(result);
  } catch (error) {
    console.error('Summary controller error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createFlashcards = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { count } = req.body;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (!subject.notes || subject.notes.length === 0) {
      return res.status(400).json({ message: 'Please upload notes first to generate flashcards.' });
    }

    const result = await generateFlashcards(subjectId, userId, Number(count) || 8);
    if (result.error) return res.status(400).json({ message: result.error });

    res.json(result);
  } catch (error) {
    console.error('Flashcard controller error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.analyzeResearch = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { mode } = req.body;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (!subject.notes || subject.notes.length === 0) {
      return res.status(400).json({ message: 'Please upload research papers or notes first to analyze.' });
    }

    const result = await analyzeResearchPaper(subjectId, userId, mode || 'breakdown');
    if (result.error) return res.status(400).json({ message: result.error });

    res.json(result);
  } catch (error) {
    console.error('Research controller error:', error);
    res.status(500).json({ message: error.message });
  }
};
