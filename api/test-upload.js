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

  // Set response timeout to 5 minutes
  res.setTimeout(300000);

  const files = [];
  const timestamp = Date.now();
  let fileCount = 0;
  let filesCompleted = 0;
  let responseAlreadySent = false;

  try {
    const bb = busboy({ headers: req.headers });

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      fileCount++;

      console.log(`Processing file: ${filename}`);

      file.on('data', (data) => chunks.push(data));

      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        files.push({
          filename,
          buffer,
          mimetype: mimeType,
          size: buffer.length,
        });
        filesCompleted++;
        console.log(`File completed: ${filename} (${buffer.length} bytes)`);
      });

      file.on('error', (err) => {
        console.error(`File stream error for ${filename}:`, err);
      });
    });

    bb.on('error', (err) => {
      console.error('Busboy error:', err);
      if (!responseAlreadySent) {
        responseAlreadySent = true;
        return res.status(500).json({ error: 'Upload parsing failed: ' + err.message });
      }
    });

    bb.on('finish', async () => {
      try {
        console.log(`Busboy finish event. Files count: ${fileCount}, completed: ${filesCompleted}`);

        // Wait for all file streams to complete (with timeout)
        let waitCount = 0;
        while (filesCompleted < fileCount && waitCount < 100) {
          await new Promise(resolve => setTimeout(resolve, 50));
          waitCount++;
        }

        console.log(`After wait: ${files.length} files ready`);

        if (files.length === 0) {
          if (!responseAlreadySent) {
            responseAlreadySent = true;
            return res.status(400).json({ error: 'No files uploaded' });
          }
          return;
        }

        const results = [];

        for (const file of files) {
          console.log(`Uploading to Supabase: ${file.filename}`);
          const filePath = `${TEST_USER_ID}/${timestamp}-${file.filename}`;

          const { error } = await supabase.storage
            .from(UPLOAD_BUCKET)
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });

          if (error) {
            console.error(`Supabase upload error for ${file.filename}:`, error);
          } else {
            console.log(`Supabase upload success: ${file.filename}`);

            const { error: dbError } = await supabase.from('uploads').insert({
              user_id: TEST_USER_ID,
              filename: file.filename,
              file_path: filePath,
              file_size: file.size,
              uploaded_at: new Date().toISOString(),
            });

            if (dbError) {
              console.error(`Database insert error for ${file.filename}:`, dbError);
            } else {
              results.push({ filename: file.filename, size: file.size });
            }
          }
        }

        console.log(`Upload complete. ${results.length} files uploaded successfully`);

        // Trigger analysis (await to ensure it gets sent)
        try {
          console.log('Triggering analysis for user:', TEST_USER_ID);
          const analyzeResponse = await fetch('https://narrative-sparringv2.vercel.app/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: TEST_USER_ID }),
          });
          console.log('Analysis triggered, status:', analyzeResponse.status);
        } catch (err) {
          console.error('Analysis trigger error:', err);
        }

        if (!responseAlreadySent) {
          responseAlreadySent = true;
          return res.status(200).json({
            success: true,
            uploaded: results,
            message: `Analysis started - check your email in 3-5 minutes. Uploaded ${results.length} files.`
          });
        }

      } catch (err) {
        console.error('Finish handler error:', err);
        if (!responseAlreadySent) {
          responseAlreadySent = true;
          return res.status(500).json({ error: err.message });
        }
      }
    });

    req.pipe(bb);

  } catch (error) {
    console.error('Handler error:', error);
    if (!responseAlreadySent) {
      responseAlreadySent = true;
      return res.status(500).json({ error: error.message });
    }
  }
};
