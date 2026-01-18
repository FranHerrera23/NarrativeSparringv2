/**
 * REPORT EMAIL DELIVERY MODULE
 * Narrative Sparring - Send reports via Resend
 *
 * Sends professional emails with report download links
 */

const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase for email logging
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Send report delivery email
 * @param {Object} params - { email, name, reportUrl, tier, reportBuffer, reportFilename }
 * @returns {Object} - { success, messageId, error }
 */
async function sendReportEmail(params) {
  const {
    email,
    name = 'there',
    reportUrl,
    tier = 'basic',
    userId,
    reportBuffer,
    reportFilename = 'narrative-sparring-report.pdf',
  } = params;

  if (!email || !reportUrl) {
    return {
      success: false,
      error: 'Missing required parameters: email and reportUrl',
    };
  }

  try {
    // Prepare email options
    const emailOptions = {
      from: 'Narrative Sparring <fran@thecruda.com>',
      to: email,
      subject: 'Your Narrative Sparring Report is Ready',
      html: generateEmailHTML(name, reportUrl, tier),
      text: generateEmailText(name, reportUrl, tier),
    };

    // Add attachment if reportBuffer is provided
    if (reportBuffer) {
      emailOptions.attachments = [
        {
          filename: reportFilename,
          content: reportBuffer,
        },
      ];
    }

    // Send email via Resend
    const response = await resend.emails.send(emailOptions);

    // Log successful email send
    await logEmail({
      user_id: userId,
      email_type: 'report_delivery',
      status: 'sent',
      resend_message_id: response.id,
      sent_at: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: response.id,
    };

  } catch (error) {
    console.error('Email send error:', error);

    // Log failed email attempt
    await logEmail({
      user_id: userId,
      email_type: 'report_delivery',
      status: 'failed',
      resend_message_id: null,
      sent_at: new Date().toISOString(),
    });

    return {
      success: false,
      error: error.message || 'Email delivery failed',
    };
  }
}

/**
 * Generate HTML email template
 */
function generateEmailHTML(name, reportUrl, tier) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Report is Ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">CRUDA</h1>
    <p style="color: #666; font-size: 14px; margin: 0;">Narrative Sparring</p>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">Your narrative audit is complete.</p>

    <p style="font-size: 16px; margin-bottom: 20px;"><strong>Your report is attached to this email</strong> and also available at the link below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${reportUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Report Online</a>
    </div>

    <p style="font-size: 16px; margin-bottom: 15px;">This 12-page diagnostic shows:</p>

    <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 25px;">
      <li style="margin-bottom: 8px;">Where your messaging breaks down</li>
      <li style="margin-bottom: 8px;">Your gap score across platforms</li>
      <li style="margin-bottom: 8px;">The core thread that actually works</li>
      <li style="margin-bottom: 8px;">What to fix first</li>
    </ul>

    <p style="font-size: 16px; margin-bottom: 20px;">Questions? Reply to this email.</p>

    <p style="font-size: 16px; margin-bottom: 0;">- CRUDA</p>
  </div>

  <div style="text-align: center; color: #999; font-size: 13px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p>© ${new Date().getFullYear()} CRUDA. All rights reserved.</p>
    <p>You received this because you purchased a Narrative Sparring diagnostic.</p>
  </div>

</body>
</html>`;
}

/**
 * Generate plain text email template
 */
function generateEmailText(name, reportUrl, tier) {
  return `Hi ${name},

Your narrative audit is complete.

Your report is attached to this email and also available online at:
${reportUrl}

This 12-page diagnostic shows:
- Where your messaging breaks down
- Your gap score across platforms
- The core thread that actually works
- What to fix first

Questions? Reply to this email.

- CRUDA

---
© ${new Date().getFullYear()} CRUDA. All rights reserved.
You received this because you purchased a Narrative Sparring diagnostic.`;
}

/**
 * Log email to database
 */
async function logEmail(emailData) {
  try {
    const { error } = await supabase
      .from('email_logs')
      .insert(emailData);

    if (error) {
      console.error('Email logging error:', error);
    }
  } catch (error) {
    // Don't fail email send if logging fails
    console.error('Email logging exception:', error);
  }
}

/**
 * Send error notification email
 * (For when analysis fails and we need to notify the user)
 */
async function sendErrorEmail(params) {
  const {
    email,
    name = 'there',
    errorMessage,
    userId,
  } = params;

  try {
    const response = await resend.emails.send({
      from: 'Narrative Sparring <fran@thecruda.com>',
      to: email,
      subject: 'Issue with Your Narrative Sparring Report',
      html: generateErrorEmailHTML(name, errorMessage),
      text: generateErrorEmailText(name, errorMessage),
    });

    await logEmail({
      user_id: userId,
      email_type: 'error_notification',
      status: 'sent',
      resend_message_id: response.id,
      sent_at: new Date().toISOString(),
    });

    return { success: true, messageId: response.id };

  } catch (error) {
    console.error('Error email send failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate error email HTML
 */
function generateErrorEmailHTML(name, errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Generation Issue</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">CRUDA</h1>
    <p style="color: #666; font-size: 14px; margin: 0;">Narrative Sparring</p>
  </div>

  <div style="background: #fff3cd; padding: 30px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 30px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">We encountered an issue generating your narrative report.</p>

    <p style="font-size: 14px; color: #666; margin-bottom: 20px;"><strong>Error:</strong> ${errorMessage || 'Unknown error occurred'}</p>

    <p style="font-size: 16px; margin-bottom: 20px;">Our team has been notified and will investigate. We'll reach out within 24 hours with next steps.</p>

    <p style="font-size: 16px; margin-bottom: 20px;">In the meantime, if you have questions, reply to this email.</p>

    <p style="font-size: 16px; margin-bottom: 0;">- CRUDA Team</p>
  </div>

  <div style="text-align: center; color: #999; font-size: 13px; padding-top: 20px; border-top: 1px solid #ddd;">
    <p>© ${new Date().getFullYear()} CRUDA. All rights reserved.</p>
  </div>

</body>
</html>`;
}

/**
 * Generate error email text
 */
function generateErrorEmailText(name, errorMessage) {
  return `Hi ${name},

We encountered an issue generating your narrative report.

Error: ${errorMessage || 'Unknown error occurred'}

Our team has been notified and will investigate. We'll reach out within 24 hours with next steps.

In the meantime, if you have questions, reply to this email.

- CRUDA Team

---
© ${new Date().getFullYear()} CRUDA. All rights reserved.`;
}

module.exports = {
  sendReportEmail,
  sendErrorEmail,
};
