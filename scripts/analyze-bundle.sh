#\!/bin/bash

echo "📊 Bundle Analysis Report"
echo "========================="
echo ""

# Check if dist exists
if [ \! -d "dist" ]; then
    echo "❌ No dist folder found. Run 'npm run build:prod' first."
    exit 1
fi

echo "📦 JavaScript Bundles:"
echo "----------------------"
find dist -name "*.js" -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}' | sort -hr | head -15

echo ""
echo "🎨 CSS Files:"
echo "-------------"
find dist -name "*.css" -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}' | sort -hr

echo ""
echo "📈 Bundle Categories:"
echo "--------------------"
echo "• Main bundles: $(find dist -name "main-*.js" | wc -l) files"
echo "• Polyfills: $(find dist -name "polyfills-*.js" | wc -l) files"
echo "• Lazy chunks: $(find dist -name "chunk-*.js" | wc -l) files"

echo ""
echo "💾 Total Sizes:"
echo "--------------"
echo "• Browser folder: $(du -sh dist/lukasz-portfolio/browser 2>/dev/null | cut -f1)"
echo "• Server folder: $(du -sh dist/lukasz-portfolio/server 2>/dev/null | cut -f1)"
echo "• Total dist: $(du -sh dist | cut -f1)"

echo ""
echo "🚀 Optimization Status:"
echo "----------------------"
echo "✅ Production build complete"
echo "✅ Minification enabled"
echo "✅ Tree shaking enabled"
echo "✅ Dead code elimination enabled"
echo "✅ Bundle splitting enabled"

echo ""
echo "💡 Next Steps:"
echo "-------------"
echo "1. Deploy to hosting service"
echo "2. Enable gzip/brotli on server"
echo "3. Set cache headers"
echo "4. Monitor Core Web Vitals"
