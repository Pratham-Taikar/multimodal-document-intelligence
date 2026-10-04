const Subject = require('../models/Subject');
const DocumentChunk = require('../models/DocumentChunk');
const path = require('path');
const fs = require('fs');

// Create Subject
exports.createSubject = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Subject name required' });
    }

    const subjectCount = await Subject.countDocuments({
      userId: req.session.userId
    });

    if (subjectCount >= 3) {
      return res.status(400).json({ message: 'Maximum 3 subjects allowed' });
    }

    const subject = await Subject.create({
      name,
      userId: req.session.userId
    });

    res.json({ message: 'Subject created', subject });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// List Subjects
exports.listSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({
      userId: req.session.userId
    });

    res.json({ subjects });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Subject
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Delete associated files
    subject.notes.forEach(note => {
      const filePath = path.join(__dirname, '..', note.path);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // Delete related document chunks
    await DocumentChunk.deleteMany({
      subjectId: req.params.id,
      userId: req.session.userId
    });

    await Subject.findByIdAndDelete(req.params.id);

    res.json({ message: 'Subject deleted' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};