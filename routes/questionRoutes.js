const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.post('/mcq/:subjectId',
  questionController.generateMCQs
);

router.post('/short/:subjectId',
  questionController.generateShortAnswer
);

module.exports = router;