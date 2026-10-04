const Subject = require('../models/Subject');
const DocumentChunk = require('../models/DocumentChunk');
const path = require('path');
const { 
  extractTextFromPDF, 
  extractTextFromTXT,
  extractTextFromDOCX,
  extractTextFromPPTX, 
  chunkText 
} = require('../services/documentProcessor');

exports.uploadDocuments = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const subject = await Subject.findOne({ 
      _id: subjectId, 
      userId: req.session.userId 
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const newFiles = files.map(file => ({
      filename: Date.now() + '-' + file.originalname,
      originalName: file.originalname
    }));

    subject.notes.push(...newFiles);
    await subject.save();

    for (const file of files) {
      try {
        await processDocument(
          file.buffer,
          file.originalname,
          subjectId,
          req.session.userId
        );
        console.log(`Successfully processed: ${file.originalname}`);
      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error.message);
      }
    }

    res.json({ 
      message: 'Files uploaded and processed', 
      files: subject.notes 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

async function processDocument(buffer, originalName, subjectId, userId) {
  const ext = path.extname(originalName).toLowerCase();
  
  let text;

  if (ext === '.pdf') {
    text = await extractTextFromPDF(buffer);
  } else if (ext === '.txt') {
    text = extractTextFromTXT(buffer);
  } else if (ext === '.docx' || ext === '.doc') {
    text = await extractTextFromDOCX(buffer);
  } else if (ext === '.pptx' || ext === '.ppt') {
    text = await extractTextFromPPTX(buffer);
  } else {
    throw new Error('Unsupported file type. Please upload PDF, TXT, DOCX, or PPTX.');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('No text content found in file');
  }

  const chunks = chunkText(text);

  for (const chunk of chunks) {
    if (chunk.content?.trim()) {
      await DocumentChunk.create({
        subjectId,
        userId,
        filename: originalName,
        originalName,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content
      });
    }
  }
}

exports.getDocuments = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findOne({ 
      _id: subjectId, 
      userId: req.session.userId 
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const files = subject.notes.map(note => ({
      name: note.originalName,
      filename: note.filename,
      uploadedAt: note.uploadedAt
    }));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { subjectId, filename } = req.params;
    
    const subject = await Subject.findOne({ 
      _id: subjectId, 
      userId: req.session.userId 
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const docIndex = subject.notes.findIndex(
      note => note.filename === filename || note.originalName === filename
    );

    if (docIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = subject.notes[docIndex];

    await DocumentChunk.deleteMany({
      subjectId,
      userId: req.session.userId,
      filename: doc.filename
    });

    subject.notes.splice(docIndex, 1);
    await subject.save();

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
};
