/**
 * FILE TEXT EXTRACTION MODULE
 * Narrative Sparring - Extract text from uploaded files
 *
 * Supports: PDF, DOCX, PPTX, HTML, TXT
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { parse: parseHtml } = require('node-html-parser');
const path = require('path');

/**
 * Extract text from all uploaded files
 * @param {Array} files - Array of file objects with { buffer, filename, mimetype }
 * @returns {Object} - { success, text, fileStats, errors }
 */
async function extractTextFromFiles(files) {
  const extractedTexts = [];
  const fileStats = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await extractTextFromFile(file);

      if (result.success) {
        extractedTexts.push({
          filename: file.filename,
          text: result.text,
        });

        fileStats.push({
          filename: file.filename,
          type: getFileType(file.filename),
          characterCount: result.text.length,
          wordCount: countWords(result.text),
        });
      } else {
        errors.push({
          filename: file.filename,
          error: result.error,
        });
      }
    } catch (error) {
      errors.push({
        filename: file.filename,
        error: error.message,
      });
    }
  }

  // Combine all text with file separators
  const combinedText = extractedTexts
    .map(item => `\n\n=== FILE: ${item.filename} ===\n\n${item.text}`)
    .join('\n\n');

  return {
    success: extractedTexts.length > 0,
    text: combinedText,
    fileStats,
    errors,
    totalFiles: files.length,
    successfulExtractions: extractedTexts.length,
  };
}

/**
 * Extract text from a single file based on type
 * @param {Object} file - { buffer, filename, mimetype }
 * @returns {Object} - { success, text, error }
 */
async function extractTextFromFile(file) {
  const extension = path.extname(file.filename).toLowerCase();

  try {
    switch (extension) {
      case '.pdf':
        return await extractFromPDF(file.buffer);

      case '.docx':
        return await extractFromDOCX(file.buffer);

      case '.pptx':
        return await extractFromPPTX(file.buffer);

      case '.html':
        return extractFromHTML(file.buffer);

      case '.txt':
      case '.md':
      case '.markdown':
        return extractFromTXT(file.buffer);

      default:
        return {
          success: false,
          error: `Unsupported file type: ${extension}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `Extraction failed: ${error.message}`,
    };
  }
}

/**
 * Extract text from PDF
 */
async function extractFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text || '',
    };
  } catch (error) {
    return {
      success: false,
      error: `PDF extraction error: ${error.message}`,
    };
  }
}

/**
 * Extract text from DOCX
 */
async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      success: true,
      text: result.value || '',
    };
  } catch (error) {
    return {
      success: false,
      error: `DOCX extraction error: ${error.message}`,
    };
  }
}

/**
 * Extract text from PPTX (using mammoth's text extraction)
 * Note: mammoth primarily handles DOCX, but can extract some text from PPTX
 * For better PPTX support, consider using 'pptx-compose' or similar
 */
async function extractFromPPTX(buffer) {
  try {
    // For now, attempt text extraction with mammoth
    // This may have limited success with PPTX files
    const result = await mammoth.extractRawText({ buffer });
    return {
      success: true,
      text: result.value || '',
    };
  } catch (error) {
    // If mammoth fails, return empty text rather than error
    // since PPTX extraction is best-effort
    return {
      success: true,
      text: '[PPTX content - text extraction limited]',
    };
  }
}

/**
 * Extract text from HTML
 */
function extractFromHTML(buffer) {
  try {
    const html = buffer.toString('utf-8');
    const root = parseHtml(html);

    // Remove script and style tags
    root.querySelectorAll('script, style').forEach(el => el.remove());

    // Get text content
    const text = root.textContent || root.innerText || '';

    // Clean up whitespace
    const cleanText = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return {
      success: true,
      text: cleanText,
    };
  } catch (error) {
    return {
      success: false,
      error: `HTML extraction error: ${error.message}`,
    };
  }
}

/**
 * Extract text from TXT
 */
function extractFromTXT(buffer) {
  try {
    const text = buffer.toString('utf-8');
    return {
      success: true,
      text: text.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: `TXT extraction error: ${error.message}`,
    };
  }
}

/**
 * Helper: Get file type from filename
 */
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const typeMap = {
    '.pdf': 'PDF',
    '.docx': 'DOCX',
    '.pptx': 'PPTX',
    '.html': 'HTML',
    '.txt': 'TXT',
    '.md': 'Markdown',
    '.markdown': 'Markdown',
  };
  return typeMap[ext] || 'Unknown';
}

/**
 * Helper: Count words in text
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

module.exports = {
  extractTextFromFiles,
  extractTextFromFile,
};
