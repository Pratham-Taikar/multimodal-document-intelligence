const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');

router.post('/summary/:subjectId', studyController.createSummary);
router.post('/flashcards/:subjectId', studyController.createFlashcards);
router.post('/research/:subjectId', studyController.analyzeResearch);

module.exports = router;
