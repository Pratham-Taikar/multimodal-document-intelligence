const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const upload = require('../config/multer');

router.post('/upload/:subjectId', upload.array('documents', 10), documentController.uploadDocuments);
router.get('/list/:subjectId', documentController.getDocuments);
router.delete('/delete/:subjectId/:filename', documentController.deleteDocument);

module.exports = router;
