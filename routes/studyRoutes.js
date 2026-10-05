const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const studyController = require('../controllers/studyController');

router.post('/summary/:subjectId', studyController.createSummary);
router.post('/flashcards/:subjectId', studyController.createFlashcards);
router.post('/research/upload/:subjectId', upload.single('researchPaper'), studyController.uploadResearchPaper);
router.get('/research/paper/:subjectId', studyController.getResearchPaper);
router.post('/research/:subjectId', studyController.analyzeResearch);

module.exports = router;
