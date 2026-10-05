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

const DocumentChunk = require('../models/DocumentChunk');
const path = require('path');
const { 
  extractTextFromPDF, 
  extractTextFromTXT,
  extractTextFromDOCX,
  chunkText 
} = require('../services/documentProcessor');

exports.uploadResearchPaper = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const file = req.file;
    const userId = req.session.userId;

    if (!file) {
      return res.status(400).json({ message: 'No research paper file provided.' });
    }

    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';
    if (ext === '.pdf') {
      text = await extractTextFromPDF(file.buffer);
    } else if (ext === '.docx' || ext === '.doc') {
      text = await extractTextFromDOCX(file.buffer);
    } else if (ext === '.txt') {
      text = extractTextFromTXT(file.buffer);
    } else {
      return res.status(400).json({ message: 'Unsupported file type. Please upload a PDF or DOCX research paper.' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'No readable text content extracted from research paper.' });
    }

    // Delete any previous dedicated research paper chunks for this subject
    await DocumentChunk.deleteMany({ subjectId, userId, isResearchPaper: true });

    // Store new research paper entry in subject
    const paperEntry = {
      filename: Date.now() + '-' + file.originalname,
      originalName: file.originalname,
      uploadedAt: new Date()
    };

    if (!subject.researchPapers) subject.researchPapers = [];
    subject.researchPapers.push(paperEntry);
    await subject.save();

    // Chunk and save with isResearchPaper: true
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      if (chunk.content?.trim()) {
        await DocumentChunk.create({
          subjectId,
          userId,
          filename: file.originalname,
          originalName: file.originalname,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          isResearchPaper: true
        });
      }
    }

    res.json({
      message: 'Dedicated research paper uploaded successfully',
      paper: {
        name: file.originalname,
        uploadedAt: paperEntry.uploadedAt,
        chunksCount: chunks.length
      }
    });
  } catch (error) {
    console.error('Research paper upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getResearchPaper = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const userId = req.session.userId;

    const subject = await Subject.findOne({ _id: subjectId, userId });
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const papers = subject.researchPapers || [];
    const latest = papers.length > 0 ? papers[papers.length - 1] : null;

    res.json({
      paper: latest ? {
        name: latest.originalName,
        uploadedAt: latest.uploadedAt
      } : null
    });
  } catch (error) {
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

    const hasResearchPaper = subject.researchPapers && subject.researchPapers.length > 0;
    const hasNotes = subject.notes && subject.notes.length > 0;

    if (!hasResearchPaper && !hasNotes) {
      return res.status(400).json({ message: 'Please upload a research paper specifically in this tab to analyze.' });
    }

    const result = await analyzeResearchPaper(subjectId, userId, mode || 'breakdown');
    if (result.error) return res.status(400).json({ message: result.error });

    res.json(result);
  } catch (error) {
    console.error('Research controller error:', error);
    res.status(500).json({ message: error.message });
  }
};
