#!/bin/bash
set -e

echo "🚀 Leafnote Analytics Deployment Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
echo ""

# Step 1: Get Resend API Key
echo -e "${YELLOW}Step 1: Resend API Key${NC}"
echo "Please enter your Resend API key (from https://resend.com):"
read -r RESEND_KEY

if [[ ! $RESEND_KEY =~ ^re_ ]]; then
    echo -e "${RED}❌ Invalid Resend API key (should start with 're_')${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Resend API key accepted${NC}"
echo ""

# Step 2: Generate REPORT_SECRET
echo -e "${YELLOW}Step 2: Generating secure report secret...${NC}"
REPORT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ Generated: $REPORT_SECRET${NC}"
echo ""

# Step 3: Login and link project
echo -e "${YELLOW}Step 3: Supabase Setup${NC}"
echo "Checking Supabase login status..."

# Try to get project list to check if logged in
if ! supabase projects list &> /dev/null; then
    echo "Please login to Supabase:"
    supabase login
fi

echo -e "${GREEN}✓ Logged in to Supabase${NC}"
echo ""

echo "Please enter your Supabase project reference ID:"
echo "(Find it in your Supabase Dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF)"
read -r PROJECT_REF

echo "Linking to project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

echo -e "${GREEN}✓ Project linked${NC}"
echo ""

# Step 4: Set secrets
echo -e "${YELLOW}Step 4: Setting function secrets...${NC}"
supabase secrets set RESEND_API_KEY="$RESEND_KEY"
supabase secrets set REPORT_TO_EMAIL=smita.kulkarni89@gmail.com
supabase secrets set REPORT_SECRET="$REPORT_SECRET"
echo -e "${GREEN}✓ Secrets configured${NC}"
echo ""

# Step 5: Deploy database migration
echo -e "${YELLOW}Step 5: Deploying database migration...${NC}"
supabase db push
echo -e "${GREEN}✓ Database migration applied${NC}"
echo ""

# Step 6: Deploy Edge Function
echo -e "${YELLOW}Step 6: Deploying Edge Function...${NC}"
supabase functions deploy weekly-report
echo -e "${GREEN}✓ Edge Function deployed${NC}"
echo ""

# Step 7: Test the function
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/weekly-report"

echo -e "${YELLOW}Step 7: Testing email delivery...${NC}"
echo "Sending test email to smita.kulkarni89@gmail.com..."
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "x-report-secret: $REPORT_SECRET" \
  -H "Content-Type: application/json")

echo "Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ SUCCESS! Test email sent!${NC}"
    echo "Check smita.kulkarni89@gmail.com (including spam folder)"
else
    echo -e "${RED}❌ Warning: Response doesn't indicate success${NC}"
    echo "Check the response above for errors"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Check your email: smita.kulkarni89@gmail.com"
echo "   (Don't forget to check spam/junk folder)"
echo ""
echo "2. Configure GitHub Actions:"
echo "   - Go to: Settings → Secrets and variables → Actions"
echo "   - Add secret SUPABASE_FUNCTION_URL: https://${PROJECT_REF}.supabase.co/functions/v1"
echo "   - Add secret REPORT_SECRET: $REPORT_SECRET"
echo ""
echo "3. Deploy your frontend:"
echo "   npm run build"
echo "   git add ."
echo "   git commit -m 'Add analytics tracking and weekly reports'"
echo "   git push origin main"
echo ""
echo "4. Reports will be sent every Friday at 9 AM UTC"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "IMPORTANT - Save these values:"
echo "REPORT_SECRET: $REPORT_SECRET"
echo "FUNCTION_URL: $FUNCTION_URL"
echo ""
