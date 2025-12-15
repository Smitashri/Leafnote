# 🚀 Quick Start - Test & Deploy Analytics

## Option 1: Automated Deployment (Recommended)

Run the deployment script that handles everything:

```bash
./deploy-analytics.sh
```

This script will:
- ✅ Prompt for your Resend API key
- ✅ Generate a secure report secret
- ✅ Deploy the database migration
- ✅ Deploy the Edge Function
- ✅ Send a test email immediately
- ✅ Show you the values needed for GitHub Actions

**Time: ~5 minutes**

---

## Option 2: Manual Step-by-Step

If you prefer manual control, follow [TEST_AND_DEPLOY.md](TEST_AND_DEPLOY.md)

---

## After Deployment

### 1. Check Your Email
📧 Look for "Leafnote Weekly Engagement Report" at **smita.kulkarni89@gmail.com**
(Check spam/junk folder if not in inbox)

### 2. Set Up GitHub Actions

Add these secrets in GitHub → Settings → Secrets and variables → Actions:

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_FUNCTION_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1` |
| `REPORT_SECRET` | (shown at end of deployment script) |

### 3. Deploy Frontend

```bash
npm run build
git add .
git commit -m "Add analytics tracking and weekly reports"
git push origin main
```

### 4. Test the Full Flow

1. Visit your deployed app
2. Perform some actions (add books, sign up, etc.)
3. Check Supabase Dashboard → Table Editor → `leafnote_events`
4. Manually trigger GitHub Actions workflow to test
5. Reports will automatically arrive every **Friday at 9 AM UTC**

---

## One-Line Test Email

After deployment, test anytime with:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weekly-report" \
  -H "x-report-secret: YOUR_SECRET"
```

---

## Support

- 📖 Full setup guide: [ANALYTICS_SETUP.md](ANALYTICS_SETUP.md)
- ✅ Deployment checklist: [ANALYTICS_CHECKLIST.md](ANALYTICS_CHECKLIST.md)
- 🔧 Troubleshooting: See ANALYTICS_SETUP.md

---

**Ready to go?** Run `./deploy-analytics.sh` now! 🚀
