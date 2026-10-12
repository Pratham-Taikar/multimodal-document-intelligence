const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract text from TXT buffer
 */
function extractTextFromTXT(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Extract text from DOC/DOCX buffer
 */
async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result && result.value && result.value.trim().length > 0) {
      return result.value;
    }
  } catch (err) {
    console.warn('Mammoth extraction fallback:', err.message);
  }
  return await officeParser.parseOfficeAsync(buffer);
}

/**
 * Extract text from PPT/PPTX buffer
 */
async function extractTextFromPPTX(buffer) {
  return await officeParser.parseOfficeAsync(buffer);
}

/**
 * Extract and analyze text & components from Image/Diagram buffer
 */
async function extractTextFromImage(buffer, originalName, options = {}) {
  const base64Data = buffer.toString('base64');
  const ext = (originalName || '').split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

  try {
    const { analyzeImageWithAI } = require('./aiService');
    const result = await analyzeImageWithAI(base64Data, mimeType, originalName, options);
    return result;
  } catch (err) {
    console.warn(`Vision AI fallback for ${originalName}:`, err.message);
    return `### 📊 Diagram / Figure Document: ${originalName}\n- **Type**: Visual Diagram / Graphic\n- **Source**: Uploaded image file \`${originalName}\`\n- **Description**: Grounded diagram included in study notes for multimodal analysis.`;
  }
}

/**
 * Chunk text into smaller pieces
 */
function chunkText(text) {
  const chunkSize = 1000;
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    const chunk = text.slice(start, end);

    chunks.push({
      content: chunk.trim(),
      chunkIndex: index
    });

    start = end;
    index++;
  }

  return chunks;
}

module.exports = {
  extractTextFromPDF,
  extractTextFromTXT,
  extractTextFromDOCX,
  extractTextFromPPTX,
  extractTextFromImage,
  chunkText
};