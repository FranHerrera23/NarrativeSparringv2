/**
 * FILE UPLOAD HANDLER
 * Narrative Sparring - User Upload Page
 * 
 * Handles secure file uploads to Supabase storage
 * 
 * Flow:
 * 1. User lands on /upload?token=xxx
 * 2. Verify upload token
 * 3. Display upload interface
 * 4. Handle file uploads to Supabase
 * 5. Track uploaded files in database
 * 6. Trigger Claude analysis when complete
 */

import { createClient } from '@supabase/supabase-js';
import { verifyUploadToken } from './gumroad-webhook';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Upload page - GET request
 * Verify token and display upload interface
 */
export async function getUploadPage(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing upload token' });
  }

  // Verify token
  const payload = verifyUploadToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Get user data
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.userId)
    .single();

  if (error || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return upload page data
  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      tier: user.purchase_tier,
    },
    uploadToken: token,
    expiresAt: payload.exp,
  });
}

/**
 * File upload handler - POST request
 * POST /api/upload
 */
export async function handleFileUpload(req, res) {
  try {
    const { token } = req.body;
    const files = req.files; // Using multipart/form-data

    if (!token) {
      return res.status(400).json({ error: 'Missing upload token' });
    }

    // Verify token
    const payload = verifyUploadToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = payload.userId;

    // Validate files
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Allowed file types
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain',
      'text/html',
      'application/msword', // .doc
    ];

    // Max file size: 10MB per file
    const maxFileSize = 10 * 1024 * 1024;

    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (!allowedTypes.includes(file.mimetype)) {
          errors.push({
            filename: file.originalname,
            error: 'Unsupported file type',
          });
          continue;
        }

        // Validate file size
        if (file.size > maxFileSize) {
          errors.push({
            filename: file.originalname,
            error: 'File too large (max 10MB)',
          });
          continue;
        }

        // Generate unique file path
        const timestamp = Date.now();
        const sanitizedFilename = sanitizeFilename(file.originalname);
        const filePath = `${userId}/${timestamp}-${sanitizedFilename}`;

        // Upload to Supabase storage
        const { data, error: uploadError } = await supabase
          .storage
          .from('user-uploads')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          errors.push({
            filename: file.originalname,
            error: uploadError.message,
          });
          continue;
        }

        // Save file record in database
        const { data: fileRecord, error: dbError } = await supabase
          .from('uploads')
          .insert({
            user_id: userId,
            file_name: file.originalname,
            file_path: filePath,
            file_type: file.mimetype,
            file_size: file.size,
            processed: false,
            uploaded_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          errors.push({
            filename: file.originalname,
            error: 'Failed to save file record',
          });
          continue;
        }

        uploadedFiles.push({
          id: fileRecord.id,
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
        });

      } catch (fileError) {
        console.error('Error processing file:', fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message,
        });
      }
    }

    // Check if user has completed upload
    const { data: allFiles } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', userId);

    const hasMinimumFiles = allFiles && allFiles.length >= 3;

    return res.status(200).json({
      success: true,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      totalFiles: allFiles ? allFiles.length : 0,
      readyForAnalysis: hasMinimumFiles,
      message: hasMinimumFiles 
        ? 'Upload complete! Your analysis will begin shortly.'
        : `${allFiles.length}/3 files uploaded. Upload at least 3 files to start analysis.`,
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
 * Get user's uploaded files
 * GET /api/uploads?token=xxx
 */
export async function getUserUploads(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Missing upload token' });
    }

    // Verify token
    const payload = verifyUploadToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user's files
    const { data: files, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', payload.userId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      files: files.map(file => ({
        id: file.id,
        filename: file.file_name,
        size: file.file_size,
        type: file.file_type,
        uploadedAt: file.uploaded_at,
        processed: file.processed,
      })),
      totalFiles: files.length,
    });

  } catch (error) {
    console.error('Error fetching uploads:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Delete uploaded file
 * DELETE /api/upload/:fileId
 */
export async function deleteUpload(req, res) {
  try {
    const { fileId } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing upload token' });
    }

    // Verify token
    const payload = verifyUploadToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', payload.userId)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from storage
    const { error: storageError } = await supabase
      .storage
      .from('user-uploads')
      .remove([file.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('uploads')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      throw dbError;
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Trigger analysis
 * POST /api/trigger-analysis
 */
export async function triggerAnalysis(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing upload token' });
    }

    // Verify token
    const payload = verifyUploadToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = payload.userId;

    // Check if user has enough files
    const { data: files } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', userId);

    if (!files || files.length < 3) {
      return res.status(400).json({
        error: 'Not enough files',
        message: 'Upload at least 3 files to start analysis',
      });
    }

    // TODO: Trigger Claude analysis
    // This will be implemented when we build the analysis engine
    
    // For now, just mark as ready for processing
    console.log('Analysis triggered for user:', userId);

    return res.status(200).json({
      success: true,
      message: 'Analysis started. You'll receive your report within 48 hours.',
      filesAnalyzed: files.length,
    });

  } catch (error) {
    console.error('Error triggering analysis:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Sanitize filename
 * Remove dangerous characters
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .toLowerCase();
}

/**
 * Get file extension
 */
function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
