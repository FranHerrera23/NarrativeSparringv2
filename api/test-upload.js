/**
 * TEST UPLOAD - NO TOKEN REQUIRED
 * Temporary endpoint for debugging
 */

const { createClient } = require('@supabase/supabase-js');
const multiparty = require('multiparty');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const UPLOAD_BUCKET = 'uploads';
const TEST_USER_ID = '17b5ae73-d16a-40bc-8db3-8bc295b063df';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new multiparty.Form();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to parse upload' });
      }

      const uploadedFiles = files.files || [];
      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Upload files
      const timestamp = Date.now();
      const results = [];

      for (const file of uploadedFiles) {
        const filePath = `${TEST_USER_ID}/${timestamp}-${file.originalFilename}`;
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(file.path);

        const { error } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(filePath, fileBuffer, {
            contentType: file.headers['content-type'],
            upsert: false,
          });

        if (!error) {
          await supabase.from('uploads').insert({
            user_id: TEST_USER_ID,
            filename: file.originalFilename,
            file_path: filePath,
            file_size: file.size,
            uploaded_at: new Date().toISOString(),
          });

          results.push({ filename: file.originalFilename, size: file.size });
        }
      }

      // Trigger analysis
      await fetch('https://narrative-sparringv2.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: TEST_USER_ID }),
      });

      return res.status(200).json({
        success: true,
        uploaded: results,
        message: 'Analysis started - check your email in 3-5 minutes'
      });
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
