#!/bin/bash

# ==========================================
# Minify and Deploy Script for GitHub Pages
# ==========================================
# This script builds, minifies, and prepares the Angular app for GitHub Pages deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Header
echo ""
echo "================================================"
echo "  🚀 MINIFY AND DEPLOY FOR GITHUB PAGES"
echo "================================================"
echo ""

# Step 1: Check prerequisites
print_info "Checking prerequisites..."

if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run from project root."
    exit 1
fi

if [ ! -d "src" ]; then
    print_error "src directory not found. Please run from project root."
    exit 1
fi

print_status "Prerequisites check passed"

# Step 2: Clean previous builds
print_info "Cleaning previous builds..."
rm -rf dist .angular/cache node_modules/.cache

# Clean root directory from previous deployments (preserve important files)
print_info "Cleaning root directory from old deployment files..."
rm -f *.js *.css *.html *.json *.txt *.map 2>/dev/null || true
rm -rf assets 3rdpartylicenses.txt .nojekyll 2>/dev/null || true

print_status "Cleanup complete"

# Step 3: Build production with minification
print_info "Building production version with minification..."
echo ""

# Build with relative base href for universal compatibility
ng build --configuration production --base-href='./' || {
    print_error "Build failed!"
    exit 1
}

print_status "Production build complete"

# Step 4: Check if build was successful
if [ ! -d "dist/lukasz-portfolio/browser" ]; then
    print_error "Build output not found at dist/lukasz-portfolio/browser"
    exit 1
fi

# Step 5: Copy all files from dist to root
print_info "Copying build files to root directory..."

# Copy all files and folders from browser directory
cp -r dist/lukasz-portfolio/browser/* . || {
    print_error "Failed to copy files from dist"
    exit 1
}

print_status "Files copied to root"

# Step 6: Ensure i18n translations are in place
if [ ! -d "assets/i18n" ]; then
    print_warning "i18n folder not found in build, copying from source..."
    mkdir -p assets/i18n
    if [ -d "src/assets/i18n" ]; then
        cp -r src/assets/i18n/* assets/i18n/
        print_status "Translations copied"
    else
        print_warning "No i18n source files found"
    fi
else
    print_status "Translations already in place"
fi

# Step 7: Create .nojekyll file for GitHub Pages
print_info "Creating GitHub Pages configuration..."
touch .nojekyll
print_status ".nojekyll file created"

# Step 8: Fix base href in index.html (ensure it's relative)
print_info "Fixing base href for compatibility..."
if [ -f "index.html" ]; then
    # Use sed to replace base href
    sed -i 's|<base href="/">|<base href="./">|g' index.html 2>/dev/null || \
    sed -i '' 's|<base href="/">|<base href="./">|g' index.html 2>/dev/null || true
    print_status "Base href updated to relative path"
fi

# Step 9: Verify critical files
print_info "Verifying deployment files..."
echo ""

MISSING_FILES=0

# Check for index.html
if [ -f "index.html" ]; then
    echo "  ✓ index.html"
else
    echo "  ✗ index.html MISSING!"
    MISSING_FILES=1
fi

# Check for styles
if ls styles-*.css 1> /dev/null 2>&1; then
    echo "  ✓ CSS files found"
else
    echo "  ✗ CSS files MISSING!"
    MISSING_FILES=1
fi

# Check for main bundle
if ls main-*.js 1> /dev/null 2>&1; then
    echo "  ✓ Main JavaScript bundle found"
else
    echo "  ✗ Main JavaScript bundle MISSING!"
    MISSING_FILES=1
fi

# Check for chunks
CHUNK_COUNT=$(ls chunk-*.js 2>/dev/null | wc -l)
if [ "$CHUNK_COUNT" -gt 0 ]; then
    echo "  ✓ $CHUNK_COUNT JavaScript chunks found"
else
    echo "  ✗ No JavaScript chunks found!"
    MISSING_FILES=1
fi

# Check for translations
if [ -f "assets/i18n/en.json" ] && [ -f "assets/i18n/pl.json" ]; then
    echo "  ✓ Translation files found"
else
    echo "  ⚠ Translation files missing (app may not work properly)"
fi

# Check for assets
if [ -d "assets" ]; then
    echo "  ✓ Assets folder found"
else
    echo "  ✗ Assets folder MISSING!"
    MISSING_FILES=1
fi

echo ""

if [ "$MISSING_FILES" -eq 1 ]; then
    print_error "Some critical files are missing! Deployment may not work properly."
else
    print_status "All critical files verified"
fi

# Step 10: Generate size report
print_info "Bundle size report:"
echo ""

# Calculate sizes
TOTAL_JS_SIZE=$(find . -maxdepth 1 -name "*.js" -exec du -ch {} + 2>/dev/null | grep total$ | cut -f1)
TOTAL_CSS_SIZE=$(find . -maxdepth 1 -name "*.css" -exec du -ch {} + 2>/dev/null | grep total$ | cut -f1)
TOTAL_SIZE=$(du -sh . --exclude=node_modules --exclude=src --exclude=dist --exclude=.git 2>/dev/null | cut -f1)

echo "  📦 JavaScript: ${TOTAL_JS_SIZE:-0}"
echo "  🎨 CSS: ${TOTAL_CSS_SIZE:-0}"
echo "  📁 Total deployment size: ${TOTAL_SIZE:-0}"
echo ""

# Step 11: Create deployment info
cat > DEPLOYMENT_INFO.txt << EOF
=================================
GitHub Pages Deployment Info
=================================
Generated: $(date)

Files deployed:
- index.html
- $(ls *.js 2>/dev/null | wc -l) JavaScript files
- $(ls *.css 2>/dev/null | wc -l) CSS files
- Assets folder with images and translations

To deploy to GitHub Pages:
1. git add .
2. git commit -m "Deploy to GitHub Pages"
3. git push

Your site will be available at:
https://[your-username].github.io/[repository-name]/

To test locally:
- Python: python3 -m http.server 8080
- Node.js: node test-server.js
- Open: http://localhost:8080

EOF

print_status "Deployment info saved to DEPLOYMENT_INFO.txt"

# Step 12: Final summary
echo ""
echo "================================================"
echo "  ✨ DEPLOYMENT READY!"
echo "================================================"
echo ""
print_status "Build minified and optimized"
print_status "Files copied to root directory"
print_status "Base href set to relative path (./)"
print_status "GitHub Pages configuration added"
echo ""
echo "📋 Next steps:"
echo "   1. Test locally: python3 -m http.server 8080"
echo "   2. Commit changes: git add . && git commit -m '🚀 Deploy'"
echo "   3. Push to GitHub: git push"
echo ""
print_info "The application is ready for GitHub Pages deployment!"
echo ""

# Optional: Start local server for testing
read -p "Do you want to start a local test server? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting local server on http://localhost:8080"
    print_info "Press Ctrl+C to stop"
    python3 -m http.server 8080
fi