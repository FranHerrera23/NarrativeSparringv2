/**
 * Check if analysis is running for a user
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TEST_USER_ID = '17b5ae73-d16a-40bc-8db3-8bc295b063df';

module.exports = async function handler(req, res) {
  try {
    // Check recent uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('uploaded_at', { ascending: false })
      .limit(10);

    if (uploadsError) {
      throw new Error(`Uploads query failed: ${uploadsError.message}`);
    }

    // Check user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', TEST_USER_ID)
      .single();

    if (userError) {
      throw new Error(`User query failed: ${userError.message}`);
    }

    // Check for any reports in the uploads bucket
    const { data: files, error: filesError } = await supabase
      .storage
      .from('uploads')
      .list(`${TEST_USER_ID}`, {
        limit: 20,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (filesError) {
      throw new Error(`Storage list failed: ${filesError.message}`);
    }

    return res.status(200).json({
      userId: TEST_USER_ID,
      user: {
        email: user.email,
        name: user.name,
        tier: user.purchase_tier,
      },
      recentUploads: uploads.map(u => ({
        filename: u.filename,
        uploadedAt: u.uploaded_at,
        size: u.file_size,
      })),
      filesInStorage: files.map(f => ({
        name: f.name,
        size: f.metadata?.size,
        createdAt: f.created_at,
        isPDF: f.name.includes('.pdf'),
      })),
      analysis: {
        totalUploads: uploads.length,
        hasReports: files.filter(f => f.name.includes('report')).length,
        lastUpload: uploads[0]?.uploaded_at,
      }
    });

  } catch (error) {
    console.error('Check analysis error:', error);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
