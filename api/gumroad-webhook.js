/**
 * GUMROAD WEBHOOK HANDLER
 * Narrative Sparring - Purchase Processing
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract purchase data from Gumroad webhook
    const {
      email,
      purchase_email,
      product_id,
      product_name,
      sale_id,
      price,
    } = req.body;

    const userEmail = email || purchase_email;
    const purchaseTier = determinePurchaseTier(product_id, product_name, price);

    if (!purchaseTier) {
      return res.status(400).json({ error: 'Unknown product' });
    }

    // Create user in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    let user;

    if (existingUser) {
      const { data: updated } = await supabase
        .from('users')
        .update({
          purchase_tier: purchaseTier,
          gumroad_order_id: sale_id,
          updated_at: new Date().toISOString(),
        })
        .eq('email', userEmail)
        .select()
        .single();
      user = updated;
    } else {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          email: userEmail,
          purchase_tier: purchaseTier,
          gumroad_order_id: sale_id,
          calendly_scheduled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      user = newUser;
    }

    // Generate upload token
    const uploadToken = generateUploadToken(user.id);

    // Send welcome email
    await sendWelcomeEmail({
      email: userEmail,
      tier: purchaseTier,
      uploadToken,
      userId: user.id,
    });

    // Send Calendly email if Solo + Live
    if (purchaseTier === 'solo_live') {
      await sendCalendlyEmail({
        email: userEmail,
        userId: user.id,
      });
    }

    return res.status(200).json({
      success: true,
      userId: user.id,
      tier: purchaseTier,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

function determinePurchaseTier(productId, productName, price) {
  const SOLO_PRODUCT_ID = process.env.GUMROAD_SOLO_PRODUCT_ID;
  const SOLO_LIVE_PRODUCT_ID = process.env.GUMROAD_SOLO_LIVE_PRODUCT_ID;

  if (productId === SOLO_PRODUCT_ID) return 'solo';
  if (productId === SOLO_LIVE_PRODUCT_ID) return 'solo_live';

  const priceNum = parseInt(price);
  if (priceNum === 19900) return 'solo';
  if (priceNum === 55000) return 'solo_live';

  const nameLower = (productName || '').toLowerCase();
  if (nameLower.includes('solo + live') || nameLower.includes('solo+live')) {
    return 'solo_live';
  }
  if (nameLower.includes('solo')) return 'solo';

  return null;
}

function generateUploadToken(userId) {
  const payload = {
    userId,
    type: 'upload',
    exp: Date.now() + (48 * 60 * 60 * 1000),
  };

  const token = crypto
    .createHmac('sha256', process.env.UPLOAD_TOKEN_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
}

async function sendWelcomeEmail({ email, tier, uploadToken, userId }) {
  const uploadUrl = `${process.env.SITE_URL}/upload?token=${uploadToken}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Narrative Sparring <sparring@narrativesparring.com>',
      to: email,
      subject: tier === 'solo_live'
        ? 'Let's spar. Upload your materials + book your call.'
        : 'Let's spar. Upload your materials.',
      html: getWelcomeEmailHTML({ tier, uploadUrl }),
    }),
  });

  const result = await response.json();

  await supabase
    .from('email_logs')
    .insert({
      user_id: userId,
      email_type: 'purchase_confirmation',
      resend_message_id: result.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

  return result;
}

async function sendCalendlyEmail({ email, userId }) {
  const calendlyUrl = `${process.env.CALENDLY_LINK}?email=${encodeURIComponent(email)}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Narrative Sparring <sparring@narrativesparring.com>',
      to: email,
      subject: 'Book your 45-minute sparring session',
      html: getCalendlyEmailHTML({ calendlyUrl }),
    }),
  });

  const result = await response.json();

  await supabase
    .from('email_logs')
    .insert({
      user_id: userId,
      email_type: 'calendly_invite',
      resend_message_id: result.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

  return result;
}

function getWelcomeEmailHTML({ tier, uploadUrl }) {
  const isSoloLive = tier === 'solo_live';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 24px 0;
      color: #0A0A0A;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background: #FF0033;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      margin: 24px 0;
    }
    ul {
      margin: 16px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h1>Let's get started.</h1>

  <p>You just bought ${isSoloLive ? 'Solo + Live' : 'Solo'}.</p>

  <p>Here's what happens next:</p>

  <p><strong>1. Upload your materials</strong></p>
  <p>Website copy, LinkedIn, pitch decks, sales docs—whatever you use publicly.</p>

  <a href="${uploadUrl}" class="cta-button">Upload Materials</a>

  <p><strong>2. I analyze everything</strong></p>
  <p>30 strategic questions expose what you're saying vs. what you mean.</p>

  <p><strong>3. You get a complete narrative audit</strong></p>
  <ul>
    <li>Your blind spots (what's missing)</li>
    <li>Your 3 core threads (what to build on)</li>
    <li>Platform-specific fixes (web, LinkedIn, sales, email)</li>
    <li>Voice guide (how to sound like you)</li>
    <li>Action plan (what to fix first)</li>
  </ul>

  ${isSoloLive ? `
  <p><strong>4. We spar live (45 minutes)</strong></p>
  <p>I challenge what's there. We find what you can't see. You walk away sharper.</p>
  <p><em>You'll receive a separate email with your Calendly link.</em></p>
  ` : ''}

  <p>— Narrative Sparring</p>
</body>
</html>
  `.trim();
}

function getCalendlyEmailHTML({ calendlyUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 24px 0;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background: #FF0033;
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <h1>Book your 45-minute sparring session.</h1>

  <p>You bought Solo + Live. That means we spar together.</p>

  <p>After you upload your materials and I send your report, we'll have a 45-minute call.</p>

  <p><strong>What we'll do:</strong></p>
  <p>I challenge what's there. You defend it. We find gaps you can't see alone.</p>

  <a href="${calendlyUrl}" class="cta-button">Book Your Call</a>

  <p>— Narrative Sparring</p>
</body>
</html>
  `.trim();
}
