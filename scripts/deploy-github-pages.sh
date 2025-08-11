#!/bin/bash

# Deploy script for GitHub Pages
# This script builds the project and copies everything to root for GitHub Pages

set -e

echo "🚀 Starting GitHub Pages deployment process..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Clean and build production
print_status "Cleaning previous builds..."
npm run clean

print_status "Building production version..."
npm run build:prod

# Step 2: Check if build was successful
if [ ! -d "dist/lukasz-portfolio/browser" ]; then
    print_error "Build failed - dist/lukasz-portfolio/browser not found"
    exit 1
fi

# Step 3: Clean root directory (preserve important files)
print_status "Cleaning root directory (preserving git, src, and config files)..."

# List of files/folders to preserve
PRESERVE=(
    ".git"
    ".gitignore"
    ".angular"
    "src"
    "scripts"
    "node_modules"
    "package.json"
    "package-lock.json"
    "angular.json"
    "tsconfig.json"
    "tsconfig.app.json"
    "tsconfig.spec.json"
    "eslint.config.js"
    ".prettierrc"
    "README.md"
    "dist"
    "server.ts"
    ".editorconfig"
    ".vscode"
    "playwright.config.ts"
    "karma.conf.js"
    "sonnet"
)

# Remove all files in root except preserved ones
find . -maxdepth 1 -type f | while read file; do
    filename=$(basename "$file")
    should_delete=true
    
    for preserve in "${PRESERVE[@]}"; do
        if [[ "$filename" == "$preserve" ]] || [[ "$file" == "./$preserve" ]]; then
            should_delete=false
            break
        fi
    done
    
    if [[ "$should_delete" == true ]] && [[ "$filename" != "deploy-github-pages.sh" ]]; then
        rm -f "$file"
        echo "  Removed: $filename"
    fi
done

# Step 4: Copy all files from dist to root
print_status "Copying build files to root directory..."
cp -r dist/lukasz-portfolio/browser/* .

# Step 4a: Ensure i18n files are copied
if [ ! -d "assets/i18n" ]; then
    print_status "Copying i18n translations..."
    mkdir -p assets/i18n
    cp -r src/assets/i18n/* assets/i18n/ 2>/dev/null || true
fi

# Step 5: Create .nojekyll file for GitHub Pages
print_status "Creating .nojekyll file..."
touch .nojekyll

# Step 6: Create CNAME file if needed (update with your domain)
# echo "yourdomain.com" > CNAME

# Step 7: Verify deployment files
print_status "Verifying deployment files..."
if [ -f "index.html" ]; then
    echo "  ✓ index.html found"
else
    print_error "index.html not found in root!"
    exit 1
fi

# Count JS and CSS files
JS_COUNT=$(find . -maxdepth 1 -name "*.js" -type f | wc -l)
CSS_COUNT=$(find . -maxdepth 1 -name "*.css" -type f | wc -l)

echo "  ✓ Found $JS_COUNT JavaScript files"
echo "  ✓ Found $CSS_COUNT CSS files"

# Step 8: Generate deployment summary
print_status "Generating deployment summary..."

cat > DEPLOYMENT.md << EOF
# Deployment Summary

**Date:** $(date)
**Build Type:** Production (Minified)

## Files Deployed

### JavaScript Bundles:
$(ls -lh *.js 2>/dev/null | awk '{print "- " $9 " (" $5 ")"}')

### CSS Files:
$(ls -lh *.css 2>/dev/null | awk '{print "- " $9 " (" $5 ")"}')

### Static Assets:
- index.html
- favicon.ico
- assets/ (images, icons, i18n)

## GitHub Pages Configuration

1. Repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / root
4. Custom domain: (optional)

## Verification

After pushing to GitHub:
1. Visit: https://[your-username].github.io
2. Check browser console for errors
3. Test all routes work correctly
4. Verify assets load properly

## Rollback

To rollback to previous version:
\`\`\`bash
git revert HEAD
git push
\`\`\`
EOF

print_status "Created DEPLOYMENT.md with deployment information"

# Step 9: Final summary
echo ""
echo "═══════════════════════════════════════════════════"
echo "  📦 GitHub Pages Deployment Ready!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Files copied to root directory:"
echo "  • $(ls -1 *.js 2>/dev/null | wc -l) JavaScript files"
echo "  • $(ls -1 *.css 2>/dev/null | wc -l) CSS files" 
echo "  • index.html"
echo "  • Static assets in /assets"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Add files: git add ."
echo "  3. Commit: git commit -m '🚀 Deploy to GitHub Pages'"
echo "  4. Push: git push"
echo ""
echo "Your site will be available at:"
echo "  https://[your-username].github.io"
echo ""
print_status "Deployment preparation complete!"