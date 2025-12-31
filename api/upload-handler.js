/**
 * FILE UPLOAD HANDLER
 * Narrative Sparring - User Upload Page
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const busboy = require('busboy');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// File validation constants
const ALLOWED_FILE_TYPES = [
  'application/pdf',                                                      // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'text/plain',                                                          // TXT
  'text/html',                                                           // HTML
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt', '.html'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MIN_FILES_REQUIRED = 3;
const UPLOAD_BUCKET = 'uploads';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const { token, files } = await parseMultipartForm(req);

    if (!token) {
      return res.status(400).json({ error: 'Missing upload token' });
    }

    // Verify token
    const payload = verifyUploadToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Validate files
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Please upload at least 3 files.'
      });
    }

    if (files.length < MIN_FILES_REQUIRED) {
      return res.status(400).json({
        error: 'Insufficient files',
        message: `Please upload at least ${MIN_FILES_REQUIRED} files. You uploaded ${files.length}.`
      });
    }

    // Validate each file
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid file',
          message: validation.error,
          filename: file.filename,
        });
      }
    }

    // Upload files to Supabase Storage
    const uploadedFiles = [];
    const userId = payload.userId;
    const timestamp = Date.now();

    for (const file of files) {
      const filePath = `${userId}/${timestamp}-${file.filename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(UPLOAD_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Storage upload error:', error);
        return res.status(500).json({
          error: 'Upload failed',
          message: `Failed to upload ${file.filename}: ${error.message}`,
        });
      }

      // Log upload to database
      const { data: uploadRecord, error: dbError } = await supabase
        .from('uploads')
        .insert({
          user_id: userId,
          filename: file.filename,
          file_path: filePath,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database insert error:', dbError);
        // Continue even if DB logging fails, as the file is uploaded
      }

      uploadedFiles.push({
        id: uploadRecord?.id || null,
        filename: file.filename,
        size: file.size,
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      uploaded: uploadedFiles,
      totalFiles: uploadedFiles.length,
      readyForAnalysis: true,
      message: 'Upload complete! Your analysis will begin shortly.',
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Parse multipart form data using busboy
 * Returns token and array of file objects with buffer, filename, mimetype, size
 */
function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const files = [];
    let token = null;

    bb.on('field', (fieldname, value) => {
      if (fieldname === 'token') {
        token = value;
      }
    });

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];

      fileStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      fileStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        files.push({
          filename,
          mimetype: mimeType,
          buffer,
          size: buffer.length,
        });
      });
    });

    bb.on('finish', () => {
      resolve({ token, files });
    });

    bb.on('error', (error) => {
      reject(error);
    });

    req.pipe(bb);
  });
}

/**
 * Validate individual file for type, extension, and size
 */
function validateFile(file) {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File ${file.filename} exceeds maximum size of 10MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  // Check file extension
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
    file.filename.toLowerCase().endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `File ${file.filename} has invalid extension. Allowed: PDF, DOCX, PPTX, TXT, HTML`,
    };
  }

  // Check MIME type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File ${file.filename} has invalid type (${file.mimetype}). Allowed: PDF, DOCX, PPTX, TXT, HTML`,
    };
  }

  return { valid: true };
}

/**
 * Verifies upload token using HMAC SHA256
 * Token format: base64(payload).hmac_signature
 * Payload contains: userId, type, exp (expiration timestamp)
 */
function verifyUploadToken(token) {
  try {
    // Split token into payload and signature
    const [payloadBase64, signature] = token.split('.');

    if (!payloadBase64 || !signature) {
      return null;
    }

    // Decode payload from base64
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    // Verify HMAC signature matches
    const expectedSignature = crypto
      .createHmac('sha256', process.env.UPLOAD_TOKEN_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    // Check if token has expired (48 hour expiration set during generation)
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;

  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
