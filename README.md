# Narrative Sparring Backend

Complete backend for Narrative Sparring: purchase processing, file uploads, and AI-powered narrative analysis.

## Architecture:
```
narrative-sparring-backend/
├── api/
│   ├── gumroad-webhook.js     # Purchase processing
│   ├── validate-token.js      # Token validation
│   ├── upload-handler.js      # File uploads
│   ├── analyze.js             # Main analysis engine
│   └── utils/
│       ├── file-extractor.js  # Text extraction (PDF, DOCX, HTML, TXT)
│       ├── claude-client.js   # Claude API integration
│       ├── report-generator.js # Markdown to PDF conversion
│       └── report-emailer.js  # Email delivery via Resend
├── package.json
├── vercel.json
└── test-analysis.js           # Test script
```

## Setup Instructions:

1. Create `api` folder in GitHub repository
2. Upload `gumroad-webhook.js` and `upload-handler.js` to the `api` folder
3. Upload `package.json` and `vercel.json` to the root
4. Connect to Vercel
5. Deploy
6. Add environment variables in Vercel dashboard

## Environment Variables Needed:

### Core Infrastructure
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (for admin access)
- `RESEND_API_KEY` - Resend API key for email delivery
- `UPLOAD_TOKEN_SECRET` - Secret key for HMAC token signing

### Claude API (NEW)
- `ANTHROPIC_API_KEY` - Your Anthropic API key (get from console.anthropic.com)
- `CLAUDE_MODEL` - Model to use (default: claude-3-5-sonnet-20241022)

### Product Configuration
- `SITE_URL` - Your frontend URL
- `GUMROAD_SOLO_PRODUCT_ID` - Gumroad product ID (testing)
- `GUMROAD_SOLO_LIVE_PRODUCT_ID` - Gumroad product ID (production)
- `CALENDLY_LINK` - Calendly scheduling link for tier upgrades

## API Endpoints:

### POST /api/gumroad-webhook
Purchase processing webhook from Gumroad.

### POST /api/validate-token
Validates upload tokens for user authentication.

### POST /api/upload-handler
Handles multipart file uploads to Supabase storage.

### POST /api/analyze
**NEW** - Main narrative analysis engine.

**Request body:**
```json
{
  "userId": "user-uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "analysisId": "analysis-uuid",
  "reportUrl": "https://storage-url/reports/report.pdf",
  "processingTime": 45,
  "stats": {
    "filesProcessed": 3,
    "tokensUsed": 25000,
    "costUSD": 0.45
  },
  "emailSent": true
}
```

## Cost Estimation:

**Claude API Pricing (Sonnet 3.5):**
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens

**Typical Analysis:**
- Input: ~10,000-20,000 tokens (uploaded documents)
- Output: ~12,000-16,000 tokens (12-15 page report)
- **Total cost per analysis: $0.30-$0.50**

## Testing:

Run the test script to verify all components:

```bash
# Install dependencies
npm install

# Set required env vars
export ANTHROPIC_API_KEY=your-key-here
export SUPABASE_URL=your-url
export SUPABASE_SERVICE_KEY=your-key

# Run test
node test-analysis.js
```

This will test:
1. File text extraction
2. Cost estimation
3. Claude API integration
4. PDF report generation

That's it.
