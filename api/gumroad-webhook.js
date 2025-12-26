/**
 * GUMROAD WEBHOOK HANDLER
 * Narrative Sparring - Purchase Processing
 * 
 * Handles Gumroad purchases and triggers user creation flow
 * 
 * Flow:
 * 1. Receive Gumroad webhook
 * 2. Validate webhook signature
 * 3. Create user in Supabase
 * 4. Generate upload token
 * 5. Send welcome email (Resend)
 * 6. If Solo + Live: send Calendly link
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for server-side operations
);

/**
 * Main webhook handler
 * POST /api/gumroad-webhook
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. VALIDATE GUMROAD WEBHOOK
    const isValid = validateGumroadWebhook(req.body, req.headers);
    if (!isValid) {
      console.error('Invalid Gumroad webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. EXTRACT PURCHASE DATA
    const {
      email,
      product_id,
      product_name,
      sale_id,
      price,
      currency,
      permalink,
      purchase_email,
    } = req.body;

    // Determine which tier was purchased
    const purchaseTier = determinePurchaseTier(product_id, product_name, price);
    
    if (!purchaseTier) {
      console.error('Unknown product purchased:', { product_id, product_name, price });
      return res.status(400).json({ error: 'Unknown product' });
    }

    console.log('Processing purchase:', {
      email: email || purchase_email,
      tier: purchaseTier,
      sale_id,
    });

    // 3. CREATE USER IN SUPABASE
    const userData = await createUser({
      email: email || purchase_email,
      purchaseTier,
      gumroadOrderId: sale_id,
    });

    if (!userData) {
      throw new Error('Failed to create user');
    }

    // 4. GENERATE UPLOAD TOKEN
    const uploadToken = generateUploadToken(userData.id);

    // 5. SEND WELCOME EMAIL
    await sendWelcomeEmail({
      email: userData.email,
      tier: purchaseTier,
      uploadToken,
      userId: userData.id,
    });

    // 6. IF SOLO + LIVE: SEND CALENDLY LINK
    if (purchaseTier === 'solo_live') {
      await sendCalendlyEmail({
        email: userData.email,
        userId: userData.id,
      });
    }

    // 7. LOG SUCCESS
    console.log('Purchase processed successfully:', {
      userId: userData.id,
      email: userData.email,
      tier: purchaseTier,
    });

    return res.status(200).json({
      success: true,
      userId: userData.id,
      tier: purchaseTier,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Validate Gumroad webhook signature
 * Gumroad doesn't use signature validation by default
 * Instead, verify the webhook came from Gumroad IP
 */
function validateGumroadWebhook(body, headers) {
  // Basic validation: check required fields exist
  const requiredFields = ['email', 'sale_id', 'product_id'];
  const hasRequiredFields = requiredFields.every(field => 
    body[field] || body.purchase_email
  );

  if (!hasRequiredFields) {
    console.error('Missing required fields in webhook');
    return false;
  }

  // Additional validation: check if request came from Gumroad
  // In production, you might want to whitelist Gumroad IPs
  // or use a custom verification parameter

  return true;
}

/**
 * Determine which tier was purchased
 * Based on product_id, product_name, or price
 */
function determinePurchaseTier(productId, productName, price) {
  // Method 1: Check by product ID (most reliable)
  const SOLO_PRODUCT_ID = process.env.GUMROAD_SOLO_PRODUCT_ID;
  const SOLO_LIVE_PRODUCT_ID = process.env.GUMROAD_SOLO_LIVE_PRODUCT_ID;

  if (productId === SOLO_PRODUCT_ID) {
    return 'solo';
  }
  
  if (productId === SOLO_LIVE_PRODUCT_ID) {
    return 'solo_live';
  }

  // Method 2: Fallback to price matching
  const priceNum = parseInt(price);
  
  if (priceNum === 19900) { // $199.00 in cents
    return 'solo';
  }
  
  if (priceNum === 55000) { // $550.00 in cents
    return 'solo_live';
  }

  // Method 3: Fallback to product name
  const nameLower = (productName || '').toLowerCase();
  
  if (nameLower.includes('solo + live') || nameLower.includes('solo+live')) {
    return 'solo_live';
  }
  
  if (nameLower.includes('solo')) {
    return 'solo';
  }

  return null;
}

/**
 * Create user in Supabase
 */
async function createUser({ email, purchaseTier, gumroadOrderId }) {
  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log('User already exists, updating tier:', email);
      
      // Update existing user with new purchase
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          purchase_tier: purchaseTier,
          gumroad_order_id: gumroadOrderId,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedUser;
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        purchase_tier: purchaseTier,
        gumroad_order_id: gumroadOrderId,
        calendly_scheduled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log('User created successfully:', newUser.id);
    return newUser;

  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Generate secure upload token
 * JWT-like token that expires in 48 hours
 */
function generateUploadToken(userId) {
  const payload = {
    userId,
    type: 'upload',
    exp: Date.now() + (48 * 60 * 60 * 1000), // 48 hours
  };

  const token = crypto
    .createHmac('sha256', process.env.UPLOAD_TOKEN_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
}

/**
 * Verify upload token
 * Used when user accesses upload page
 */
export function verifyUploadToken(token) {
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
      console.error('Invalid token signature');
      return null;
    }

    // Check expiration
    if (Date.now() > payload.exp) {
      console.error('Token expired');
      return null;
    }

    return payload;

  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Send welcome email with upload link
 */
async function sendWelcomeEmail({ email, tier, uploadToken, userId }) {
  try {
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

    if (!response.ok) {
      throw new Error(`Resend API error: ${result.message}`);
    }

    // Log email in database
    await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        email_type: 'purchase_confirmation',
        resend_message_id: result.id,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    console.log('Welcome email sent:', result.id);
    return result;

  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

/**
 * Send Calendly booking email (Solo + Live only)
 */
async function sendCalendlyEmail({ email, userId }) {
  try {
    // Generate personalized Calendly link with pre-filled email
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

    if (!response.ok) {
      throw new Error(`Resend API error: ${result.message}`);
    }

    // Log email in database
    await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        email_type: 'calendly_invite',
        resend_message_id: result.id,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    console.log('Calendly email sent:', result.id);
    return result;

  } catch (error) {
    console.error('Error sending Calendly email:', error);
    throw error;
  }
}

/**
 * Welcome email HTML template
 */
function getWelcomeEmailHTML({ tier, uploadUrl }) {
  const isSoloLive = tier === 'solo_live';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Narrative Sparring</title>
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
      line-height: 1.6;
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
      letter-spacing: 0.5px;
      margin: 24px 0;
      border-radius: 0;
    }
    .divider {
      border: 0;
      border-top: 1px solid #E5E5E5;
      margin: 32px 0;
    }
    .footer {
      font-size: 14px;
      color: #666;
      margin-top: 40px;
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
  <p>30 strategic questions expose what you're saying vs. what you mean. Where you're inconsistent. What's not landing.</p>
  
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
  <p><em>You'll receive a separate email with your Calendly link to book the call.</em></p>
  ` : ''}
  
  <hr class="divider">
  
  <p><strong>Timeline:</strong></p>
  <p>Upload your materials → Report delivered within 48 hours${isSoloLive ? ' → Book your call' : ''}.</p>
  
  <p><strong>Questions?</strong></p>
  <p>Reply to this email. I read everything.</p>
  
  <p>— Narrative Sparring</p>
  
  <div class="footer">
    <p>Built by CRUDA<br>
    A narrative studio helping founders translate expertise into clear narrative.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Calendly booking email HTML template
 */
function getCalendlyEmailHTML({ calendlyUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Book Your Sparring Session</title>
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
      line-height: 1.6;
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
      letter-spacing: 0.5px;
      margin: 24px 0;
      border-radius: 0;
    }
    .footer {
      font-size: 14px;
      color: #666;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <h1>Book your 45-minute sparring session.</h1>
  
  <p>You bought Solo + Live. That means we spar together.</p>
  
  <p>After you upload your materials and I send your report, we'll have a 45-minute call.</p>
  
  <p><strong>What we'll do:</strong></p>
  <p>I challenge what's there. You defend it. We find gaps you can't see alone.</p>
  
  <p>You walk away with 3 things:</p>
  <p>1. Which narrative threads to build on<br>
  2. What to stop saying<br>
  3. What to fix first</p>
  
  <a href="${calendlyUrl}" class="cta-button">Book Your Call</a>
  
  <p><strong>Timing:</strong></p>
  <p>Book anytime that works for you. We'll connect after your report is ready.</p>
  
  <p>— Narrative Sparring</p>
  
  <div class="footer">
    <p>Built by CRUDA<br>
    A narrative studio helping founders translate expertise into clear narrative.</p>
  </div>
</body>
</html>
  `.trim();
}
