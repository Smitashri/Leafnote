#!/bin/bash

echo "🚀 Deploying Leafnote Analytics"
echo "================================"
echo ""

# Configuration
PROJECT_REF="ipeihablpncfzgkwvdhi"
SUPABASE_URL="https://ipeihablpncfzgkwvdhi.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZWloYWJscG5jZnpna3d2ZGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTU2MzY5OSwiZXhwIjoyMDgxMTM5Njk5fQ.-dEmlJadRhV4VwTEY60JM7Plo9HKu2sSbpifgiawT-U"
RESEND_API_KEY="re_j5UYc3Jb_EQQ3eGCWJ2C3AoCrEPEzP1Lk"
REPORT_SECRET=$(openssl rand -base64 32)

echo "✓ Configuration loaded"
echo "✓ Generated REPORT_SECRET: $REPORT_SECRET"
echo ""

# Step 1: Apply Database Migration
echo "📊 Step 1: Creating leafnote_events table..."
echo ""

SQL_MIGRATION=$(cat supabase/migrations/2025_12_13_create_leafnote_events_table.sql)

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_MIGRATION" | jq -Rs .)}" 2>/dev/null

# Alternative: Use psql if available
if command -v psql &> /dev/null; then
  echo "Using direct SQL execution..."
  cat supabase/migrations/2025_12_13_create_leafnote_events_table.sql | \
    PGPASSWORD="${SERVICE_ROLE_KEY}" psql -h db.${PROJECT_REF}.supabase.co -U postgres -d postgres 2>/dev/null
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  MANUAL STEP REQUIRED: Deploy Edge Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Please follow these steps in Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
echo ""
echo "2. Click 'Create a new function'"
echo ""
echo "3. Enter function name: weekly-report"
echo ""
echo "4. Copy the entire content from:"
echo "   ${PWD}/supabase/functions/weekly-report/index.ts"
echo ""
echo "5. Paste it into the function editor and click 'Deploy'"
echo ""
echo "6. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions"
echo ""
echo "7. Add these three secrets:"
echo "   RESEND_API_KEY = ${RESEND_API_KEY}"
echo "   REPORT_TO_EMAIL = smita.kulkarni89@gmail.com"
echo "   REPORT_SECRET = ${REPORT_SECRET}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Press ENTER after you've completed the dashboard steps above..."
echo ""

# Step 2: Test the Edge Function
echo "📧 Step 2: Testing email delivery..."
echo ""

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/weekly-report" \
  -H "x-report-secret: ${REPORT_SECRET}" \
  -H "Content-Type: application/json")

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ SUCCESS! Test email sent!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📧 Check: smita.kulkarni89@gmail.com"
  echo "   (Don't forget to check spam/junk folder)"
else
  echo "⚠️  Email may not have sent. Check response above."
  echo "   Verify secrets are set correctly in Supabase Dashboard"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS: Configure GitHub Actions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to GitHub Repository → Settings → Secrets and variables → Actions"
echo ""
echo "2. Add these two repository secrets:"
echo ""
echo "   SUPABASE_FUNCTION_URL = ${SUPABASE_URL}/functions/v1"
echo "   REPORT_SECRET = ${REPORT_SECRET}"
echo ""
echo "3. Commit and push your code:"
echo "   git add ."
echo "   git commit -m 'Add analytics tracking and weekly reports'"
echo "   git push origin main"
echo ""
echo "4. Reports will automatically arrive every Friday at 9 AM UTC"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💾 SAVE THESE VALUES:"
echo ""
echo "REPORT_SECRET: ${REPORT_SECRET}"
echo "Function URL: ${SUPABASE_URL}/functions/v1/weekly-report"
echo ""
echo "Test anytime with:"
echo "curl -X POST '${SUPABASE_URL}/functions/v1/weekly-report' \\"
echo "  -H 'x-report-secret: ${REPORT_SECRET}'"
echo ""
