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

const zlib = require('zlib');

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
  try {
    const ast = await officeParser.parseOffice(buffer, { fileType: 'docx' });
    if (ast && typeof ast.to === 'function') {
      const { value } = await ast.to('text');
      if (value && value.trim().length > 0) return value;
    } else if (typeof ast === 'string' && ast.trim().length > 0) {
      return ast;
    }
  } catch (err) {
    console.warn('officeParser docx error:', err.message);
  }
  return '';
}

/**
 * Extract text from PPT/PPTX buffer
 */
async function extractTextFromPPTX(buffer) {
  // 1. Try modern officeParser v8
  try {
    const ast = await officeParser.parseOffice(buffer, { fileType: 'pptx' });
    if (ast && typeof ast.to === 'function') {
      const { value } = await ast.to('text');
      if (value && value.trim().length > 0) return value;
    } else if (typeof ast === 'string' && ast.trim().length > 0) {
      return ast;
    }
  } catch (err) {
    console.warn('officeParser PPTX attempt failed, using fallback:', err.message);
  }

  // 2. Direct ZIP XML slide text extractor (Native Node.js zlib)
  try {
    const textFromZip = extractTextFromZipBuffer(buffer);
    if (textFromZip && textFromZip.trim().length > 0) {
      return textFromZip;
    }
  } catch (err) {
    console.warn('Zip PPTX extraction failed:', err.message);
  }

  // 3. Binary string extraction fallback (for legacy binary .ppt files)
  try {
    const textFromBinary = extractPrintableTextFromBinary(buffer);
    if (textFromBinary && textFromBinary.trim().length > 0) {
      return textFromBinary;
    }
  } catch (err) {
    console.warn('Binary PPT extraction failed:', err.message);
  }

  throw new Error('Unable to extract readable text from presentation file.');
}

/**
 * Native ZIP extractor for PPTX slides XML text
 */
function extractTextFromZipBuffer(buffer) {
  const slidesText = [];
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset++;
      continue;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const filename = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;

    if (dataStart + compressedSize <= buffer.length) {
      if (filename.includes('slide') && filename.endsWith('.xml')) {
        try {
          const compData = buffer.slice(dataStart, dataStart + compressedSize);
          const decomp = compression === 8 ? zlib.inflateRawSync(compData) : compData;
          const xml = decomp.toString('utf8');
          const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
          if (matches && matches.length > 0) {
            const slideWords = matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
            if (slideWords.length > 0) {
              slidesText.push(`Slide ${slidesText.length + 1}:\n` + slideWords.join(' '));
            }
          }
        } catch (e) {
          // ignore corrupted individual slide
        }
      }
    }
    offset = dataStart + compressedSize;
  }
  return slidesText.join('\n\n');
}

/**
 * Fallback for legacy binary .ppt presentations
 */
function extractPrintableTextFromBinary(buffer) {
  const raw = buffer.toString('latin1');
  const matches = raw.match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
  return matches
    .map(s => s.trim())
    .filter(s => s.length >= 4 && !/^(PK|word|xml|Content_Types)/i.test(s))
    .join(' ');
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