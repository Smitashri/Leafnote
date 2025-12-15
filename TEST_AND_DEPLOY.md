# Testing & Deployment Guide

## Step 1: Set Up Resend API Key

1. Go to https://resend.com and sign up/log in
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `re_`)

## Step 2: Deploy the Edge Function

Run these commands in order:

```bash
# 1. Login to Supabase (if not already logged in)
supabase login

# 2. Link to your project (replace YOUR_PROJECT_REF with your actual project ref)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Generate a secure random secret
echo "Your REPORT_SECRET: $(openssl rand -base64 32)"

# 4. Set the secrets (replace with actual values)
supabase secrets set RESEND_API_KEY=re_your_actual_key_here
supabase secrets set REPORT_TO_EMAIL=smita.kulkarni89@gmail.com
supabase secrets set REPORT_SECRET=paste_the_generated_secret_here

# 5. Deploy the Edge Function
supabase functions deploy weekly-report

# 6. Note your function URL (it will be displayed after deployment)
# Format: https://YOUR_PROJECT_REF.supabase.co/functions/v1
```

## Step 3: Test the Email Immediately

After deployment, test the function:

```bash
# Replace YOUR_PROJECT_REF and YOUR_SECRET with actual values
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report" \
  -H "x-report-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -v

# Expected output: JSON with "ok": true and summary metrics
# Check smita.kulkarni89@gmail.com for the email (including spam folder)
```

## Step 4: Apply Database Migration

```bash
# Run the migration to create the events table
supabase db push

# Verify in Supabase Dashboard:
# - Go to Table Editor
# - Check that 'leafnote_events' table exists
```

## Step 5: Configure GitHub Actions

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Add these repository secrets:

   - **SUPABASE_FUNCTION_URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`
   - **REPORT_SECRET**: Same secret you set in Step 2

4. Commit and push the updated workflow file

## Step 6: Deploy Frontend to Production

```bash
# Build the production version
npm run build

# Deploy to your hosting (GitHub Pages, Netlify, etc.)
# For GitHub Pages:
git add .
git commit -m "Add analytics tracking and weekly reports"
git push origin main
```

## Step 7: Test GitHub Actions (Optional)

1. Go to GitHub repository → **Actions** tab
2. Select "Leafnote Weekly Report" workflow
3. Click "Run workflow" → "Run workflow"
4. Monitor the run - should complete successfully
5. Check your email again

## Verification Checklist

- [ ] Resend API key obtained
- [ ] Edge Function deployed successfully
- [ ] Test email received at smita.kulkarni89@gmail.com
- [ ] Database migration applied
- [ ] GitHub secrets configured
- [ ] Frontend deployed with tracking
- [ ] Events appearing in `leafnote_events` table
- [ ] Weekly schedule set to Friday 9 AM UTC

## Quick Test Commands

```bash
# Check if events are being tracked (after using the app)
# Run in Supabase SQL Editor:
SELECT COUNT(*) as event_count, event_name 
FROM leafnote_events 
GROUP BY event_name 
ORDER BY event_count DESC;

# Manual test of weekly report
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report" \
  -H "x-report-secret: YOUR_SECRET"
```

## Troubleshooting

**Email not received?**
- Check spam/junk folder
- Verify RESEND_API_KEY is correct
- For sandbox mode, ensure smita.kulkarni89@gmail.com is verified in Resend
- Check Resend dashboard for delivery logs

**Function deployment failed?**
- Update Supabase CLI: `npm update -g supabase`
- Re-link project: `supabase link --project-ref YOUR_REF`
- Check function logs in Supabase Dashboard

**Events not tracked?**
- Check browser console for errors
- Verify Supabase anon key in src/supabaseClient.js
- Ensure migration was applied successfully

---

Next: Run Step 1-3 to test the email now!
