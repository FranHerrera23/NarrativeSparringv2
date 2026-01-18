/**
 * NARRATIVE ANALYSIS ENGINE
 * Narrative Sparring - Main Analysis Endpoint
 *
 * Orchestrates the complete narrative audit workflow:
 * 1. Fetch user and uploaded files
 * 2. Download files from Supabase storage
 * 3. Extract text from all files
 * 4. Send to Claude API for analysis
 * 5. Generate PDF report
 * 6. Upload report to storage
 * 7. Send email with download link
 * 8. Update database
 */

const { createClient } = require('@supabase/supabase-js');
const { extractTextFromFiles } = require('./utils/file-extractor');
const { generateNarrativeReport } = require('./utils/claude-client');
const { generateHTML } = require('./utils/report-generator');
const { sendReportEmail, sendErrorEmail } = require('./utils/report-emailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const UPLOAD_BUCKET = 'uploads';
const REPORT_BUCKET = 'uploads'; // Reuse uploads bucket for reports

module.exports = async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let analysisId = null;

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Step 1: Fetch user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, purchase_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 2: Fetch uploaded files from database (only recent uploads from last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('id, filename, file_path, file_size')
      .eq('user_id', userId)
      .gte('uploaded_at', tenMinutesAgo)
      .order('uploaded_at', { ascending: true });

    if (uploadsError) {
      console.error('Uploads lookup error:', uploadsError);
      return res.status(500).json({ error: 'Failed to fetch uploads' });
    }

    if (!uploads || uploads.length === 0) {
      return res.status(400).json({ error: 'No uploaded files found for this user' });
    }

    // Step 3: Create analysis record with correct analysis_type
    const { data: analysis, error: analysisCreateError } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        analysis_type: 'full_report',
        analysis_content: { status: 'processing', started_at: new Date().toISOString() },
        sent_to_user: false,
      })
      .select()
      .single();

    if (analysisCreateError) {
      console.error('Analysis record creation error:', analysisCreateError);
      return res.status(500).json({ error: 'Failed to create analysis record' });
    }

    analysisId = analysis.id;

    // Step 4: Download files from Supabase storage
    console.log(`Downloading ${uploads.length} files from storage...`);
    const fileBuffers = [];

    for (const upload of uploads) {
      console.log(`Downloading file: ${upload.filename} from path: ${upload.file_path}`);

      // Use public URL since bucket is public (more reliable than download API)
      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${upload.file_path}`;
      console.log(`Fetching from public URL: ${publicUrl}`);

      const response = await fetch(publicUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to download ${upload.filename}: HTTP ${response.status} - ${response.statusText}`);
      }

      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      fileBuffers.push({
        filename: upload.filename,
        buffer,
        size: upload.file_size,
      });
    }

    // Step 5: Extract text from all files
    console.log('Extracting text from files...');
    const extraction = await extractTextFromFiles(fileBuffers);

    if (!extraction.success || !extraction.text) {
      throw new Error('Text extraction failed - no content extracted from files');
    }

    console.log(`Extracted ${extraction.text.length} characters from ${extraction.successfulExtractions} files`);

    // Step 6: Send to Claude API for analysis
    console.log('Sending to Claude API for narrative analysis...');
    const claudeResult = await generateNarrativeReport(extraction.text);

    if (!claudeResult.success) {
      throw new Error(`Claude API error: ${claudeResult.error}`);
    }

    console.log(`Claude analysis complete. Tokens used: ${claudeResult.tokensUsed.total}, Cost: $${claudeResult.costUSD.total.toFixed(4)}`);

    // Step 7: Generate HTML report (skip PDF due to serverless compatibility issues)
    console.log('Generating HTML report...');
    const htmlReport = generateHTML(claudeResult.report, {
      title: 'Narrative Sparring Diagnostic Report',
    });
    const reportBuffer = Buffer.from(htmlReport, 'utf-8');
    const reportFilename = `report-${userId}-${Date.now()}.html`;
    const reportContentType = 'text/html';

    // Step 8: Upload report to Supabase storage
    console.log('Uploading report to storage...');
    const reportPath = `reports/${reportFilename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(reportPath, reportBuffer, {
        contentType: 'text/html; charset=utf-8',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Report upload failed: ${uploadError.message}`);
    }

    // Get public URL for report
    const { data: urlData } = supabase.storage
      .from(REPORT_BUCKET)
      .getPublicUrl(reportPath);

    const reportUrl = urlData.publicUrl;

    // Step 9: Update analysis record (status: completed)
    const processingTime = Math.round((Date.now() - startTime) / 1000); // seconds

    const { error: updateError } = await supabase
      .from('analyses')
      .update({
        analysis_content: {
          status: 'completed',
          report_url: reportUrl,
          tokens_used: claudeResult.tokensUsed.total,
          cost_usd: claudeResult.costUSD.total,
          completed_at: new Date().toISOString(),
          processing_time_seconds: processingTime,
        },
        sent_to_user: true,
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('Analysis update error:', updateError);
      // Don't fail the request - report is generated
    }

    // Step 10: Send email with report link
    console.log('Sending report email...');
    const emailResult = await sendReportEmail({
      email: user.email,
      name: 'there',
      reportUrl,
      tier: user.purchase_tier,
      userId: user.id,
    });

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      // Don't fail the request - report is still available
    }

    // Step 11: Return success
    return res.status(200).json({
      success: true,
      analysisId,
      reportUrl,
      processingTime,
      stats: {
        filesProcessed: extraction.successfulExtractions,
        tokensUsed: claudeResult.tokensUsed.total,
        costUSD: claudeResult.costUSD.total,
      },
      emailSent: emailResult.success,
    });

  } catch (error) {
    console.error('Analysis error:', error);

    // Update analysis record with failure
    if (analysisId) {
      await supabase
        .from('analyses')
        .update({
          analysis_content: {
            status: 'failed',
            error_message: error.message,
            failed_at: new Date().toISOString(),
          },
          sent_to_user: false,
        })
        .eq('id', analysisId);
    }

    // Try to send error notification email
    if (req.body.userId) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('email')
          .eq('id', req.body.userId)
          .single();

        if (user) {
          await sendErrorEmail({
            email: user.email,
            name: 'there',
            errorMessage: error.message,
            userId: req.body.userId,
          });
        }
      } catch (emailError) {
        console.error('Error email send failed:', emailError);
      }
    }

    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      analysisId,
    });
  }
};
