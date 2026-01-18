/**
 * TEST UPLOAD - NO TOKEN REQUIRED
 * Temporary endpoint for debugging
 */

const { createClient } = require('@supabase/supabase-js');
const busboy = require('busboy');

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
    const bb = busboy({ headers: req.headers });
    const files = [];
    const timestamp = Date.now();
    let fileCount = 0;
    let filesCompleted = 0;

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      fileCount++;

      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        files.push({
          filename,
          buffer: Buffer.concat(chunks),
          mimetype: mimeType,
          size: chunks.reduce((acc, chunk) => acc + chunk.length, 0),
        });
        filesCompleted++;
      });
    });

    bb.on('finish', async () => {
      // Wait for all file streams to complete
      while (filesCompleted < fileCount) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];

      for (const file of files) {
        const filePath = `${TEST_USER_ID}/${timestamp}-${file.filename}`;

        const { error } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (!error) {
          await supabase.from('uploads').insert({
            user_id: TEST_USER_ID,
            filename: file.filename,
            file_path: filePath,
            file_size: file.size,
            uploaded_at: new Date().toISOString(),
          });

          results.push({ filename: file.filename, size: file.size });
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

    req.pipe(bb);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
