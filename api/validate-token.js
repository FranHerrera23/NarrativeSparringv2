/**
 * VALIDATE TOKEN HANDLER
 * Narrative Sparring - Token Verification for Upload Page
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Verify token using same logic as token generation
    const payload = verifyUploadToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Query Supabase to get user details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, purchase_tier')
      .eq('id', payload.userId)
      .single();

    if (error || !user) {
      console.error('User lookup error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Return success with user data
    return res.status(200).json({
      success: true,
      userId: user.id,
      email: user.email,
      tier: user.purchase_tier,
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
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
