# Leafnote Analytics & Weekly Reports Setup Guide

This guide explains how to set up user engagement tracking and weekly email reports for Leafnote.

## Overview

The analytics system consists of:
1. **Database table** (`leafnote_events`) to store user engagement events
2. **Frontend tracking** in React app to capture user actions
3. **Supabase Edge Function** to generate weekly reports
4. **GitHub Actions workflow** to schedule weekly report emails

## 1. Database Setup

### Run the Migration

Apply the SQL migration to create the `leafnote_events` table:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration in Supabase Dashboard:
# Dashboard → SQL Editor → paste contents of:
# supabase/migrations/2025_12_13_create_leafnote_events_table.sql
```

### Verify Table Creation

Check that the table was created with proper RLS (Row Level Security):
- Table `leafnote_events` exists
- Indexes are created on: `created_at`, `event_name`, `user_id`, `anon_id`
- RLS is enabled with INSERT-only policy for public users

## 2. Frontend Tracking

The analytics module (`src/analytics.js`) is already integrated into the React app. It tracks:

- **app_open**: When the app loads
- **signup_success**: After successful user registration
- **login_success**: After successful password login
- **add_read_click**: When user clicks "Add Read" button
- **add_read_success**: When a read book is successfully saved
- **add_toread_click**: When user clicks "Add To-Read" button
- **add_toread_success**: When a to-read book is successfully saved

Each event includes:
- `anon_id`: Anonymous user ID (generated once, stored in localStorage)
- `user_id`: Supabase auth user ID (if logged in)
- `book_title`, `book_author`, `book_rating`, `book_status`: Book details (when applicable)

No action needed - tracking is automatic once the migration is applied.

## 3. Deploy Supabase Edge Function

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Supabase project set up

### Link Your Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### Set Function Secrets

```bash
# Required: Resend API key for sending emails
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx

# Required: Email address to receive weekly reports
supabase secrets set REPORT_TO_EMAIL=smita.kulkarni89@gmail.com

# Required: Secret for authenticating GitHub Actions requests
supabase secrets set REPORT_SECRET=your_random_secret_here

# These are automatically available in Edge Functions:
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
```

To generate a secure random secret:
```bash
# macOS/Linux
openssl rand -base64 32
```

### Deploy the Function

```bash
supabase functions deploy weekly-report
```

### Get Function URL

After deployment, note the function URL:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report
```

### Test the Function Locally

```bash
# Start local Supabase
supabase start

# Serve the function
supabase functions serve weekly-report --env-file ./supabase/.env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/weekly-report \
  -H "x-report-secret: your_secret_here"
```

## 4. Set Up Resend for Email Sending

### Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain (or use the Resend sandbox for testing)
3. Create an API key in the dashboard

### Configure Sending Domain (Optional)

For production, add and verify your custom domain:
- Go to Resend Dashboard → Domains
- Add your domain and follow DNS verification steps
- Update the Edge Function's `from` address to use your domain

For testing, you can use `onboarding@resend.dev` (sandbox - delivers only to your verified email).

## 5. Configure GitHub Actions

### Add Repository Secrets

In your GitHub repository:
1. Go to **Settings → Secrets and variables → Actions**
2. Add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `SUPABASE_FUNCTION_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1` | Your Supabase functions base URL |
| `REPORT_SECRET` | Same as set in Supabase secrets | Authentication secret |

### Workflow Schedule

The workflow (`.github/workflows/weekly-report.yml`) runs:
- **Automatically**: Every Monday at 9:00 AM UTC
- **Manually**: Via GitHub Actions UI (workflow_dispatch)

### Test the Workflow

1. Go to **Actions** tab in GitHub
2. Select "Leafnote Weekly Report" workflow
3. Click "Run workflow" → "Run workflow"
4. Check the run logs to verify success

## 6. Verify Everything Works

### Check Event Tracking

1. Open your Leafnote app
2. Perform some actions (add a book, sign up, etc.)
3. In Supabase Dashboard → Table Editor → `leafnote_events`
4. Verify events are being recorded

### Test Weekly Report

Trigger the report manually:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report" \
  -H "x-report-secret: YOUR_SECRET" \
  -H "Content-Type: application/json"
```

Check your email (`smita.kulkarni89@gmail.com`) for the report.

### Report Contents

The email includes:
- **Summary metrics**: New users, repeat users, add read clicks, add to-read clicks
- **CSV attachment** with:
  - User engagement data (per-user activity in last 7 days)
  - Book activity data (books added with counts and ratings)

## Weekly Metrics Definitions

| Metric | Definition |
|--------|------------|
| **New users** | Anonymous IDs first seen in the last 7 days |
| **Repeat users** | Anonymous IDs active in last 7 days AND had activity before the 7-day window |
| **Add Read clicks** | Count of "add_read_click" events in last 7 days |
| **Add To-Read clicks** | Count of "add_toread_click" events in last 7 days |

## Security & Privacy

✅ **Implemented safeguards:**
- Events table has RLS enabled - public can INSERT only
- SELECT/UPDATE/DELETE require service role (server-side only)
- Weekly report function uses service role key (not exposed to frontend)
- GitHub Actions workflow uses secrets for authentication
- Edge Function validates `x-report-secret` header before running
- No passwords or sensitive data are tracked
- Anonymous IDs are client-generated UUIDs, not personally identifiable

## Troubleshooting

### Events not appearing in database

- Check browser console for errors in `trackEvent()` calls
- Verify Supabase anon key is correctly configured in `supabaseClient.js`
- Check RLS policies in Supabase Dashboard

### Weekly report not sending

- Verify all Supabase secrets are set: `supabase secrets list`
- Check Edge Function logs: Supabase Dashboard → Edge Functions → Logs
- Verify RESEND_API_KEY is valid and not rate-limited
- Check GitHub Actions logs for errors

### GitHub Actions workflow failing

- Verify repository secrets are set correctly
- Check that SUPABASE_FUNCTION_URL doesn't have trailing slash
- Verify REPORT_SECRET matches what's set in Supabase

### Email not received

- Check spam/junk folder
- Verify REPORT_TO_EMAIL is correct
- For Resend sandbox, ensure the email is verified in Resend dashboard
- Check Resend dashboard for delivery status

## Maintenance

### Update Report Email Address

```bash
supabase secrets set REPORT_TO_EMAIL=new.email@domain.com
```

### Change Report Schedule

Edit `.github/workflows/weekly-report.yml` cron schedule:
```yaml
schedule:
  - cron: '0 9 * * 1'  # Minute Hour DayOfMonth Month DayOfWeek
```

[Cron schedule syntax reference](https://crontab.guru/)

### View Historical Events

```sql
-- In Supabase SQL Editor
SELECT 
  event_name,
  COUNT(*) as count,
  DATE(created_at) as date
FROM leafnote_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_name, DATE(created_at)
ORDER BY date DESC, count DESC;
```

## Next Steps

1. Monitor event collection for a week
2. Review first weekly report email
3. Adjust tracking or reporting queries as needed
4. Consider adding more event types for deeper insights
5. Set up custom domain in Resend for branded emails

## Support

For issues or questions:
- Check Supabase Edge Function logs
- Review GitHub Actions run logs
- Verify all environment variables and secrets are set correctly
- Ensure database migration ran successfully

---

**Note**: This is a privacy-focused analytics system. It tracks usage patterns without collecting personally identifiable information beyond what users explicitly provide through authentication.
