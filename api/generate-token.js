/**
 * SIMPLE TOKEN GENERATOR ENDPOINT
 * Just visit this URL to get a fresh upload token
 */

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Default user ID (your test account)
    const userId = '17b5ae73-d16a-40bc-8db3-8bc295b063df';

    // Create payload
    const payload = {
      userId,
      type: 'upload',
      exp: Date.now() + (48 * 60 * 60 * 1000), // 48 hours
    };

    // Sign with HMAC
    const payloadJson = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadJson).toString('base64');

    const signature = crypto
      .createHmac('sha256', process.env.UPLOAD_TOKEN_SECRET)
      .update(payloadJson)
      .digest('hex');

    const token = `${payloadBase64}.${signature}`;

    // Generate upload URL
    const uploadUrl = `https://narrative-sparring-cruda.lovable.app/upload?token=${token}`;

    // Return simple HTML page with the link
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Upload Link Generator</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 600px;
      margin: 100px auto;
      padding: 40px;
      text-align: center;
      background: #000;
      color: #fff;
    }
    h1 { margin-bottom: 30px; }
    .link {
      background: #1a1a1a;
      padding: 20px;
      border-radius: 8px;
      word-break: break-all;
      margin: 30px 0;
      font-size: 14px;
      color: #00ff00;
    }
    button {
      background: #ff0000;
      color: white;
      border: none;
      padding: 15px 40px;
      font-size: 16px;
      cursor: pointer;
      border-radius: 4px;
      margin: 10px;
    }
    button:hover { opacity: 0.8; }
    .success {
      color: #00ff00;
      margin-top: 10px;
      display: none;
    }
  </style>
</head>
<body>
  <h1>📎 Upload Link Ready</h1>
  <p>Share this link with anyone who needs to upload files:</p>
  <div class="link" id="link">${uploadUrl}</div>
  <button onclick="copyLink()">📋 Copy Link</button>
  <button onclick="location.reload()">🔄 Generate New Link</button>
  <div class="success" id="success">✅ Copied to clipboard!</div>

  <script>
    function copyLink() {
      const link = document.getElementById('link').textContent;
      navigator.clipboard.writeText(link).then(() => {
        document.getElementById('success').style.display = 'block';
        setTimeout(() => {
          document.getElementById('success').style.display = 'none';
        }, 2000);
      });
    }
  </script>
</body>
</html>`;

    return res.status(200).setHeader('Content-Type', 'text/html').send(html);

  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({
      error: 'Token generation failed',
      message: error.message,
    });
  }
};
