/**
 * Generate upload token manually for testing
 * Usage: node generate-upload-token.js
 */

const crypto = require('crypto');

// User ID from logs
const userId = '17b5ae73-d16a-40bc-8db3-8bc295b063df';

// You need to set this environment variable
// Get it from Vercel dashboard -> Settings -> Environment Variables
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET || 'CHANGE_ME_TO_YOUR_SECRET';

function generateUploadToken(userId) {
  const payload = {
    userId,
    type: 'upload',
    exp: Date.now() + (48 * 60 * 60 * 1000), // 48 hours
  };

  const token = crypto
    .createHmac('sha256', UPLOAD_TOKEN_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
}

const token = generateUploadToken(userId);
const uploadUrl = `https://narrative-sparringv2.vercel.app/upload?token=${token}`;

console.log('\n✅ Upload token generated!\n');
console.log('Token:', token);
console.log('\n📎 Full upload URL:\n');
console.log(uploadUrl);
console.log('\n');
