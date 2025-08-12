#!/bin/bash

# Script to add GitHub secrets from .env.production file
# Usage: ./scripts/add-github-secrets.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated with gh
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}Reading .env.production and adding secrets to GitHub...${NC}\n"

# Track statistics
total_vars=0
added_vars=0
skipped_vars=0
failed_vars=0
converted_vars=0

# Arrays to track results
declare -a added_secrets=()
declare -a failed_secrets=()
declare -a skipped_secrets=()

# Parse .env.production and add each variable as a secret
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -z "$key" || "$key" == \#* ]]; then
        continue
    fi
    
    total_vars=$((total_vars + 1))
    
    # Remove EXPO_PUBLIC_ prefix if present
    original_key="$key"
    if [[ "$key" == EXPO_PUBLIC_* ]]; then
        key="${key#EXPO_PUBLIC_}"
        echo -e "${YELLOW}📝 Converting EXPO_PUBLIC_$key → $key${NC}"
        converted_vars=$((converted_vars + 1))
    fi
    
    # Remove quotes from value if present
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Skip if value is empty
    if [[ -z "$value" ]]; then
        echo -e "${YELLOW}⏭️  Skipping $original_key (empty value)${NC}"
        skipped_vars=$((skipped_vars + 1))
        skipped_secrets+=("$original_key (empty)")
        continue
    fi
    
    echo -n "🔑 Adding secret $key... "
    
    # Add as repository secret with better error handling
    output=$(gh secret set "$key" --body "$value" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        added_vars=$((added_vars + 1))
        added_secrets+=("$key")
    else
        if echo "$output" | grep -q "already exists"; then
            echo -e "${YELLOW}⚠️  Already exists (updating)${NC}"
            # Try to update it
            gh secret set "$key" --body "$value" --force 2>/dev/null
            added_vars=$((added_vars + 1))
            added_secrets+=("$key (updated)")
        else
            echo -e "${RED}❌ Failed${NC}"
            echo -e "  ${RED}Error: $output${NC}"
            failed_vars=$((failed_vars + 1))
            failed_secrets+=("$key: $output")
        fi
    fi
    
done < .env.production

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Summary Report${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📁 Total variables found: ${total_vars}"
echo -e "✅ Successfully added: ${GREEN}${added_vars}${NC}"
echo -e "🔄 Converted from EXPO_PUBLIC_: ${YELLOW}${converted_vars}${NC}"
echo -e "⏭️  Skipped (empty): ${YELLOW}${skipped_vars}${NC}"
echo -e "❌ Failed: ${RED}${failed_vars}${NC}"

if [ ${#added_secrets[@]} -gt 0 ]; then
    echo -e "\n${GREEN}✅ Successfully Added Secrets:${NC}"
    for secret in "${added_secrets[@]}"; do
        echo -e "  • $secret"
    done
fi

if [ ${#failed_secrets[@]} -gt 0 ]; then
    echo -e "\n${RED}❌ Failed Secrets:${NC}"
    for secret in "${failed_secrets[@]}"; do
        echo -e "  • $secret"
    done
fi

if [ ${#skipped_secrets[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}⏭️  Skipped Secrets:${NC}"
    for secret in "${skipped_secrets[@]}"; do
        echo -e "  • $secret"
    done
fi

# Verify secrets were added
echo -e "\n${GREEN}🔍 Verifying secrets in GitHub...${NC}"
echo "Current repository secrets:"
gh secret list 2>/dev/null | head -10 || echo -e "${RED}Could not list secrets${NC}"

echo -e "\n${GREEN}Done! Now add your EXPO_TOKEN manually:${NC}"
echo "1. Go to https://expo.dev/accounts/[your-account]/settings/access-tokens"
echo "2. Create a robot user named 'github-actions' with Developer role"
echo "3. Generate an access token"
echo "4. Run: gh secret set EXPO_TOKEN"
echo "   (it will prompt for the value)"

echo -e "\n${YELLOW}Optional: Create environments for better control:${NC}"
echo "gh api repos/:owner/:repo/environments --method PUT --field name=preview"
echo "gh api repos/:owner/:repo/environments --method PUT --field name=production"