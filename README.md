# Narrative Sparring Backend

Backend for Narrative Sparring purchase processing and file uploads.

## Files to upload to GitHub:
```
narrative-sparring-backend/
├── api/
│   ├── gumroad-webhook.js
│   └── upload-handler.js
├── package.json
└── vercel.json
```

## Setup Instructions:

1. Create `api` folder in GitHub repository
2. Upload `gumroad-webhook.js` and `upload-handler.js` to the `api` folder
3. Upload `package.json` and `vercel.json` to the root
4. Connect to Vercel
5. Deploy
6. Add environment variables in Vercel dashboard

## Environment Variables Needed:

- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- RESEND_API_KEY
- UPLOAD_TOKEN_SECRET
- SITE_URL
- GUMROAD_SOLO_PRODUCT_ID
- GUMROAD_SOLO_LIVE_PRODUCT_ID
- CALENDLY_LINK

That's it.
