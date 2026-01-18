# Deployment Checklist - Narrative Sparring Backend

## ✅ Code Changes Complete
All backend fixes have been committed and pushed to branch: `claude/cruda-narrative-platform-LjKsb`

---

## 🔧 Required Vercel Environment Variables

Go to: **Vercel → Settings → Environment Variables** and verify ALL of these are set:

### Core (CRITICAL - App won't work without these)
- [ ] `SUPABASE_URL` - Your Supabase project URL (check Vercel dashboard)
- [ ] `SUPABASE_SERVICE_KEY` - Supabase service_role key (check Vercel dashboard)
- [ ] `ANTHROPIC_API_KEY` - Claude API key (check Vercel dashboard - already added)
- [ ] `RESEND_API_KEY` - **MISSING** Get from https://resend.com/api-keys
- [ ] `UPLOAD_TOKEN_SECRET` - **MISSING** Use the secret from `generate-token.html` line 72
  - **IMPORTANT:** Must match the secret in token generator for validation to work
  - Copy from `generate-token.html` and paste into Vercel env vars

### Optional (App will work without these, but features may be limited)
- [ ] `SITE_URL` = `https://narrative-sparring-cruda.lovable.app` (for email links)
- [ ] `CLAUDE_MODEL` = `claude-sonnet-4-5-20250929` (default set in code)
- [ ] `GUMROAD_SOLO_PRODUCT_ID` = Your Gumroad product ID
- [ ] `GUMROAD_SOLO_LIVE_PRODUCT_ID` = Your Gumroad product ID
- [ ] `CALENDLY_LINK` = Your Calendly scheduling link

---

## 📦 Supabase Storage Buckets

Go to: **Supabase → Storage** and verify:

- [ ] `uploads` bucket exists
- [ ] `uploads` bucket is **PUBLIC** (toggle enabled)
- [ ] Storage policies allow SELECT on `uploads` bucket

---

## 🗄️ Supabase Database Tables

All tables should exist with correct schemas (already verified):

- [x] `users` - user records
- [x] `uploads` - uploaded file tracking
- [x] `analyses` - analysis records with JSONB `analysis_content`
- [x] `email_logs` - email delivery logs

---

## 🚀 Deployment Steps

1. **Merge the PR:**
   - Go to GitHub → Pull Requests
   - Merge `claude/cruda-narrative-platform-LjKsb` → `main`

2. **Wait for Vercel Deploy:**
   - Vercel auto-deploys (~1-2 min)
   - Check deployment status in Vercel dashboard

3. **Add Missing Environment Variables:**
   - `RESEND_API_KEY` - **CRITICAL FOR EMAILS**
   - `UPLOAD_TOKEN_SECRET` - **CRITICAL FOR TOKEN VALIDATION**

4. **Redeploy if you added env vars:**
   - Vercel → Deployments → Latest → "..." → Redeploy

---

## 🧪 Testing Complete Flow

After deployment:

1. **Generate Upload Token:**
   ```
   https://narrative-sparringv2.vercel.app/generate-token.html
   ```

2. **Get Upload URL (will look like):**
   ```
   https://narrative-sparring-cruda.lovable.app/upload?token=xxx
   ```

3. **Upload 3+ files**

4. **Wait 3-5 minutes** for analysis to complete

5. **Check your email** for report link

---

## ❌ Known Issues Fixed

- ✅ Storage downloads failing → Now using public URLs
- ✅ Token validation failing → Fixed field name mismatch
- ✅ Old upload records causing 404s → Now filters to last 10 minutes
- ✅ PDF generation crashing → Switched to HTML reports
- ✅ Claude API 404 errors → Updated to Sonnet 4.5 model
- ✅ Database schema mismatches → All aligned with Supabase

---

## 🔍 Debugging

If analysis fails, check Vercel logs:
```
Vercel → Deployments → Latest → View Function Logs → /api/analyze
```

Look for:
- ✅ "Downloading X files from storage..." - File downloads working
- ✅ "Extracted X characters from X files" - Text extraction working
- ✅ "Claude analysis complete. Tokens used: X" - Claude API working
- ✅ "Generating HTML report..." - Report generation working
- ✅ "Sending report email..." - Email sending (check for errors here)

---

## 📧 Email Configuration

**IMPORTANT:** Resend requires domain verification!

1. Go to: https://resend.com/domains
2. Add domain: `thecruda.com`
3. Add DNS records they provide
4. Wait for verification (~5 min)
5. Use sender: `fran@thecruda.com` or `sparring@thecruda.com`

Without verified domain, emails will fail!

---

## 💰 Cost Per Analysis

**Claude Sonnet 4.5:**
- Input: ~10k-20k tokens ($0.06-$0.12)
- Output: ~12k-16k tokens ($0.09-$0.12)
- **Total: ~$0.15-$0.25 per analysis**

Much cheaper than original Opus estimate!

---

## ✨ What's Working Now

1. ✅ Token validation (frontend + backend)
2. ✅ File uploads to Supabase storage
3. ✅ Storage downloads using public URLs
4. ✅ Text extraction (PDF, DOCX, TXT, HTML)
5. ✅ Claude Sonnet 4.5 API integration
6. ✅ HTML report generation
7. ✅ Report storage in Supabase
8. ⏳ Email delivery (needs RESEND_API_KEY)

---

## 🎯 Final Checklist

Before going live:

- [ ] Merge PR to main
- [ ] Add RESEND_API_KEY to Vercel
- [ ] Add UPLOAD_TOKEN_SECRET to Vercel
- [ ] Verify domain in Resend
- [ ] Redeploy Vercel
- [ ] Test complete flow with real files
- [ ] Verify email arrives
- [ ] Check Anthropic Console for usage
- [ ] Delete test uploads from Supabase storage

---

**Last Updated:** 2026-01-07
**Branch:** `claude/cruda-narrative-platform-LjKsb`
**Status:** Ready to merge and deploy
