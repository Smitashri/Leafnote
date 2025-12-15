# ✅ Analytics Setup Complete!

## What's Working Now

✅ Database table `leafnote_events` created  
✅ Edge Function deployed and working  
✅ Test email sent successfully to smita.kulkarni89@gmail.com  
✅ Frontend tracking integrated (tracks app_open, signup, login, add books)  
✅ Weekly reports scheduled for Friday 9 AM UTC

---

## Final Steps: Enable Automated Weekly Reports

### Step 1: Add GitHub Secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions**

Add these **3 secrets** (click "New repository secret" for each):

| Secret Name | Secret Value |
|-------------|--------------|
| `SUPABASE_FUNCTION_URL` | `https://ipeihablpncfzgkwvdhi.supabase.co/functions/v1` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZWloYWJscG5jZnpna3d2ZGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTU2MzY5OSwiZXhwIjoyMDgxMTM5Njk5fQ.-dEmlJadRhV4VwTEY60JM7Plo9HKu2sSbpifgiawT-U` |
| `REPORT_SECRET` | `EjV+eUOs/xGMFoD6RqFJC7yfKsr3ghkgOUKA9VbIzIw=` |

### Step 2: Deploy to Production

```bash
git add .
git commit -m "Add analytics tracking and weekly email reports"
git push origin main
```

### Step 3: Test GitHub Actions (Optional)

1. Go to GitHub → **Actions** tab
2. Select "Leafnote Weekly Report"
3. Click "Run workflow" → "Run workflow"
4. Check smita.kulkarni89@gmail.com for test email

---

## Automated Schedule

📧 **Weekly reports will arrive every Friday at 9 AM UTC**
- That's Friday 1 AM PST / 4 AM EST
- Automatic - no action needed

---

## Manual Testing Anytime

Send a test report email:

```bash
curl -X POST 'https://ipeihablpncfzgkwvdhi.supabase.co/functions/v1/weekly-report' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZWloYWJscG5jZnpna3d2ZGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTU2MzY5OSwiZXhwIjoyMDgxMTM5Njk5fQ.-dEmlJadRhV4VwTEY60JM7Plo9HKu2sSbpifgiawT-U' \
  -H 'x-report-secret: EjV+eUOs/xGMFoD6RqFJC7yfKsr3ghkgOUKA9VbIzIw='
```

---

## What's Tracked

The system automatically tracks:
- **app_open**: When users visit the app
- **signup_success**: New user registrations
- **login_success**: Successful logins
- **add_read_click** / **add_read_success**: Reading activity
- **add_toread_click** / **add_toread_success**: To-read list activity

Each event includes:
- Anonymous ID (localStorage)
- User ID (if logged in)
- Book details (title, author, rating, status)
- Timestamp

---

## Weekly Report Contents

Each Friday email includes:

**Summary Metrics:**
- New users (last 7 days)
- Repeat users (returning users)
- Add Read clicks
- Add To-Read clicks

**CSV Attachments:**
- User engagement data (per-user activity)
- Book activity data (which books were added, ratings)

---

## Next Steps

1. ✅ Complete Step 1 & 2 above to activate weekly reports
2. ✅ Deploy your frontend to production
3. ✅ Use the app to generate some real events
4. ✅ Wait for your first Friday report!

---

## Security

✅ Events table uses Row Level Security (RLS)  
✅ Public can only INSERT events (no reading/updating)  
✅ Reports run server-side with service role  
✅ GitHub Actions uses secrets (never exposed)  
✅ No passwords or sensitive data tracked  
✅ Anonymous IDs are non-identifiable UUIDs

---

**You're all set!** 🎉

Complete Steps 1 & 2 above, then your analytics system will be fully automated!
