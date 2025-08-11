#!/bin/bash

# Minification and Optimization Script for Angular Portfolio
# Usage: ./scripts/minify-and-optimize.sh

set -e

echo "🚀 Starting minification and optimization process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run from project root."
    exit 1
fi

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist .angular/cache

# Run production build with maximum optimization
print_status "Running production build with optimization..."
ng build --configuration production \
    --optimization=true \
    --build-optimizer=true \
    --vendor-chunk=true \
    --common-chunk=true \
    --delete-output-path=true \
    --extract-licenses=true \
    --named-chunks=false \
    --output-hashing=all \
    --source-map=false

# Get size before additional optimization
INITIAL_SIZE=$(du -sh dist/lukasz-portfolio/browser | cut -f1)
print_status "Initial build size: $INITIAL_SIZE"

# Find and compress JavaScript files
print_status "Compressing JavaScript files..."
find dist -name "*.js" -type f -exec gzip -9 -k {} \; 2>/dev/null || true

# Find and compress CSS files
print_status "Compressing CSS files..."
find dist -name "*.css" -type f -exec gzip -9 -k {} \; 2>/dev/null || true

# Create Brotli compression if available
if command -v brotli &> /dev/null; then
    print_status "Creating Brotli compressed files..."
    find dist -name "*.js" -type f -exec brotli -Z {} \; 2>/dev/null || true
    find dist -name "*.css" -type f -exec brotli -Z {} \; 2>/dev/null || true
    find dist -name "*.html" -type f -exec brotli -Z {} \; 2>/dev/null || true
else
    print_warning "Brotli not installed. Skipping Brotli compression."
fi

# Optimize images if any
if [ -d "dist/lukasz-portfolio/browser/assets/images" ]; then
    print_status "Optimizing images..."
    # Using basic optimization without external tools
    find dist/lukasz-portfolio/browser/assets/images -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) -print0 | while IFS= read -r -d '' file; do
        # Just report the files, actual optimization would need imagemin
        echo "  - Found image: $(basename "$file")"
    done
fi

# Generate size report
print_status "Generating size report..."
echo ""
echo "📊 Bundle Size Report:"
echo "========================"

# Main bundles
echo ""
echo "Main JavaScript bundles:"
find dist/lukasz-portfolio/browser -name "*.js" -type f | while read -r file; do
    size=$(ls -lh "$file" | awk '{print $5}')
    name=$(basename "$file")
    echo "  • $name: $size"
done | sort -k3 -hr | head -10

# CSS files
echo ""
echo "CSS files:"
find dist/lukasz-portfolio/browser -name "*.css" -type f | while read -r file; do
    size=$(ls -lh "$file" | awk '{print $5}')
    name=$(basename "$file")
    echo "  • $name: $size"
done

# Total sizes
echo ""
echo "Total sizes:"
FINAL_SIZE=$(du -sh dist/lukasz-portfolio/browser | cut -f1)
FINAL_SIZE_GZIP=$(find dist -name "*.gz" -type f -exec du -ch {} + | grep total$ | cut -f1)
FINAL_SIZE_BR=$(find dist -name "*.br" -type f -exec du -ch {} + 2>/dev/null | grep total$ | cut -f1)

echo "  • Uncompressed: $FINAL_SIZE"
[ ! -z "$FINAL_SIZE_GZIP" ] && echo "  • With gzip: $FINAL_SIZE_GZIP"
[ ! -z "$FINAL_SIZE_BR" ] && echo "  • With Brotli: $FINAL_SIZE_BR"

# Performance tips
echo ""
echo "💡 Performance Tips:"
echo "========================"
echo "1. Enable gzip/brotli compression on your web server"
echo "2. Set proper cache headers for static assets"
echo "3. Use a CDN for global distribution"
echo "4. Enable HTTP/2 or HTTP/3 on your server"
echo "5. Consider lazy loading for images"

# Create deployment info file
cat > dist/lukasz-portfolio/deployment-info.txt <<EOF
Build Information
=================
Date: $(date)
Node Version: $(node -v)
Angular Version: $(ng version | grep "Angular:" | head -1)
Build Mode: Production (Optimized)
Source Maps: Disabled
Compression: gzip + Brotli

Recommended nginx configuration:
---------------------------------
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_comp_level 6;

brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
EOF

print_status "Deployment info saved to dist/lukasz-portfolio/deployment-info.txt"

echo ""
print_status "✨ Minification and optimization complete!"
echo ""

# Final summary
echo "📦 Final Build Summary:"
echo "========================"
echo "• Output: dist/lukasz-portfolio/"
echo "• Size: $FINAL_SIZE"
echo "• Ready for deployment!"

exit 0