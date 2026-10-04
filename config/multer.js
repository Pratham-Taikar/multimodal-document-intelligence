const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const ALLOWED_EXTS = new Set(['.pdf', '.txt', '.docx', '.doc', '.pptx', '.ppt']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, TXT, DOCX, and PPTX files are allowed'));
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10485760 } // 10MB
});