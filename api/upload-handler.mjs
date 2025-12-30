/**
 * FILE UPLOAD HANDLER
 * Narrative Sparring - User Upload Page
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // This is a placeholder for file upload functionality
    // Will be implemented when building the upload frontend

    return res.status(200).json({
      success: true,
      message: 'Upload handler ready',
      userId: payload.userId,
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

function verifyUploadToken(token) {
  try {
    const [payloadBase64, signature] = token.split('.');

    if (!payloadBase64 || !signature) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.UPLOAD_TOKEN_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;

  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
