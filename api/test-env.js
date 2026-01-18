/**
 * TEST ENVIRONMENT VARIABLES
 * Diagnostic endpoint to check if environment variables are configured
 */

module.exports = async function handler(req, res) {
  try {
    const envCheck = {
      SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'NOT SET',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET (length: ' + process.env.ANTHROPIC_API_KEY.length + ')' : 'NOT SET',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'SET (length: ' + process.env.RESEND_API_KEY.length + ')' : 'NOT SET',
      UPLOAD_TOKEN_SECRET: process.env.UPLOAD_TOKEN_SECRET ? 'SET (length: ' + process.env.UPLOAD_TOKEN_SECRET.length + ')' : 'NOT SET',
    };

    // Test basic Supabase connection
    let supabaseTest = 'Not tested';
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      // Try a simple query
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        supabaseTest = `Error: ${error.message}`;
      } else {
        supabaseTest = 'Connection successful';
      }
    } catch (err) {
      supabaseTest = `Exception: ${err.message}`;
    }

    return res.status(200).json({
      environment: envCheck,
      supabaseConnectionTest: supabaseTest,
      nodeVersion: process.version,
      vercelRegion: process.env.VERCEL_REGION || 'unknown',
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
