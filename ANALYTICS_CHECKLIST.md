# Leafnote Analytics Quick Start Checklist

## ✅ Pre-deployment Checklist

- [ ] Supabase project created and configured
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Resend account created (https://resend.com)
- [ ] Resend API key obtained

## ✅ Database Setup

- [ ] Run migration: `supabase db push`
- [ ] Verify `leafnote_events` table exists in Supabase Dashboard
- [ ] Confirm RLS policies are enabled (INSERT only for public)

## ✅ Edge Function Deployment

- [ ] Link project: `supabase link --project-ref YOUR_PROJECT_REF`
- [ ] Generate REPORT_SECRET: `openssl rand -base64 32`
- [ ] Set secrets:
  ```bash
  supabase secrets set RESEND_API_KEY=re_xxxxx
  supabase secrets set REPORT_TO_EMAIL=smita.kulkarni89@gmail.com
  supabase secrets set REPORT_SECRET=your_secret_here
  ```
- [ ] Deploy function: `supabase functions deploy weekly-report`
- [ ] Note function URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report`

## ✅ Resend Configuration

- [ ] Verify sending domain (or use sandbox `onboarding@resend.dev`)
- [ ] Test API key works
- [ ] Whitelist recipient email (if using sandbox)

## ✅ GitHub Actions Setup

- [ ] Add repository secret: `SUPABASE_FUNCTION_URL`
  - Value: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`
- [ ] Add repository secret: `REPORT_SECRET`
  - Value: Same as the secret set in Supabase
- [ ] Commit and push `.github/workflows/weekly-report.yml`

## ✅ Testing

- [ ] Test frontend tracking (check Supabase Dashboard → `leafnote_events` table)
- [ ] Test Edge Function manually:
  ```bash
  curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report" \
    -H "x-report-secret: YOUR_SECRET"
  ```
- [ ] Verify email received
- [ ] Trigger GitHub Actions workflow manually (Actions tab → Run workflow)

## ✅ Go Live

- [ ] Deploy frontend with tracking enabled
- [ ] Monitor events for 1 week
- [ ] Review first automated weekly report email
- [ ] Adjust as needed

## 🔧 Common Issues

| Problem | Solution |
|---------|----------|
| Events not tracked | Check browser console, verify anon key in `supabaseClient.js` |
| Function deployment fails | Check Supabase CLI version, re-link project |
| Email not sent | Verify RESEND_API_KEY, check Resend dashboard for errors |
| GitHub Actions fails | Verify secrets are set, check function URL format |

## 📚 Documentation

- Full setup guide: `ANALYTICS_SETUP.md`
- Environment variables: `supabase/functions/.env.example`
- Migration file: `supabase/migrations/2025_12_13_create_leafnote_events_table.sql`
- Edge Function: `supabase/functions/weekly-report/index.ts`
- GitHub workflow: `.github/workflows/weekly-report.yml`
- Frontend tracking: `src/analytics.js`

---

**Support**: See ANALYTICS_SETUP.md for detailed troubleshooting
