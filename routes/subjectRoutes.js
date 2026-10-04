const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');

router.post('/create', subjectController.createSubject);
router.get('/list', subjectController.listSubjects);
router.delete('/:id', subjectController.deleteSubject);

module.exports = router;