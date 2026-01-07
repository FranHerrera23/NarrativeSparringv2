# Supabase Schema Requirements for Narrative Sparring

## Tables Required

### 1. `users` table
**Columns the code uses:**
- `id` (uuid, primary key)
- `email` (text)
- `purchase_tier` (text)
- `gumroad_order_id` (text)
- `calendly_scheduled` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**DO NOT INCLUDE:** `first_name` (code no longer references this)

### 2. `uploads` table
**Columns the code uses:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `filename` (text)
- `file_path` (text) - CRITICAL: path in storage bucket
- `file_size` (integer)
- `uploaded_at` (timestamptz) - NOTE: code uses this, NOT upload_date
- `created_at` (timestamptz)

### 3. `analyses` table
**Columns the code uses:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `analysis_type` (text) - MUST be one of: 'blind_spots', 'threads', 'fixes', 'voice_guide', 'full_report'
- `analysis_content` (jsonb) - ALL analysis data stored here as JSON
- `created_at` (timestamptz)
- `sent_to_user` (boolean)

**Structure of `analysis_content` JSONB:**
```json
{
  "status": "processing|completed|failed",
  "started_at": "ISO timestamp",
  "report_url": "https://...",
  "tokens_used": 12000,
  "cost_usd": 0.45,
  "completed_at": "ISO timestamp",
  "processing_time_seconds": 45,
  "error_message": "if failed"
}
```

### 4. `email_logs` table
**Columns the code expects:** (CURRENTLY FAILING - column 'email' missing!)
- `id` (uuid, primary key)
- `email` (text) - **MISSING IN YOUR DATABASE**
- `subject` (text)
- `status` (text)
- `message_id` (text)
- `sent_at` (timestamptz)
- `error_message` (text, nullable)

**Current error:** `Could not find the 'email' column of 'email_logs' in the schema cache`

**What your table probably has instead:**
- `user_id` (uuid)
- `email_type` (text)
- `resend_message_id` (text)

## Storage Buckets

### `uploads` bucket
**Required RLS Policies:**

1. **INSERT Policy** (for uploads) ✅ You have this
   - Name: "Allow all uploads"
   - Operation: INSERT
   - Policy: `bucket_id = 'uploads'`

2. **SELECT Policy** (for downloads) ❌ CRITICAL - MISSING OR NOT WORKING
   - Name: "Allow downloads from uploads bucket"
   - Operation: SELECT
   - Policy: `bucket_id = 'uploads'`
   - Applied to: ALL (public)

**Storage Issue:** Downloads failing with `StorageUnknownError` means:
- SELECT policy doesn't exist, OR
- SELECT policy syntax is wrong, OR
- RLS is blocking service_role key (shouldn't happen but possible)

## Immediate Fixes Needed

### Fix 1: Add `email` column to `email_logs` table
OR better: **Disable email logging temporarily** by commenting out the logEmail calls until you fix the schema.

### Fix 2: Verify Storage SELECT policy
Go to Supabase → Storage → Policies → "OTHER POLICIES UNDER STORAGE.OBJECTS"
You MUST have a policy with:
- **Checkbox: ✅ SELECT** (not INSERT, not UPDATE)
- **Definition:** `bucket_id = 'uploads'`

### Fix 3: Verify `analyses` table has `analysis_type` constraint
Check that analysis_type allows 'full_report' value.

## Testing Checklist

Once fixed, this should work:
1. Upload files → saves to storage ✅
2. Trigger analysis → creates record in analyses table ✅
3. Download files from storage → SELECT policy allows it ❌ FAILING
4. Extract text → process files ✅
5. Call Claude API → generate report
6. Save PDF to storage
7. Send email (will fail if email_logs schema wrong)

## Current Blocker

**Storage downloads are failing.** The SERVICE_ROLE key should bypass RLS, but it's not working.

**Two solutions:**
A. Fix the SELECT policy (preferred)
B. Temporarily disable RLS on storage.objects table (NOT recommended for production)
