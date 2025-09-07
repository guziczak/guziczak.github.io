#!/usr/bin/env python3
"""
Minify and Deploy Script for GitHub Pages
==========================================
Builds, minifies, and prepares Angular app for deployment
"""

import os
import sys
import shutil
import subprocess
import json
import re
import gzip
from pathlib import Path
from datetime import datetime

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(message):
    """Print success message"""
    print(f"{Colors.GREEN}✓{Colors.ENDC} {message}")

def print_warning(message):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠{Colors.ENDC} {message}")

def print_error(message):
    """Print error message"""
    print(f"{Colors.RED}✗{Colors.ENDC} {message}")

def print_info(message):
    """Print info message"""
    print(f"{Colors.BLUE}ℹ{Colors.ENDC} {message}")

def print_header():
    """Print script header"""
    print("\n" + "=" * 50)
    print("  🚀 MINIFY AND DEPLOY FOR GITHUB PAGES")
    print("=" * 50 + "\n")

def clean_directory():
    """Clean previous builds and deployment files"""
    print_info("Cleaning previous builds...")
    
    # Clean dist and cache
    dirs_to_clean = ['dist', '.angular/cache', 'node_modules/.cache']
    for dir_path in dirs_to_clean:
        if os.path.exists(dir_path):
            shutil.rmtree(dir_path)
    
    # Clean root directory from old deployment files
    patterns_to_remove = [
        '*.js', '*.css', '*.map', '*.txt', 
        'index.html', 'ngsw.json', '3rdpartylicenses.txt'
    ]
    
    for pattern in patterns_to_remove:
        for file in Path('.').glob(pattern):
            if file.name not in ['test-server.js', 'minify_and_deploy.py']:
                try:
                    file.unlink()
                except:
                    pass
    
    # Remove assets folder
    if os.path.exists('assets'):
        shutil.rmtree('assets')
    
    # Remove .nojekyll
    if os.path.exists('.nojekyll'):
        os.remove('.nojekyll')
    
    print_status("Cleanup complete")

def build_production():
    """Build Angular app in production mode"""
    print_info("Building production version with minification...")
    
    try:
        # Build with absolute base href for GitHub Pages user site
        result = subprocess.run(
            ['npm', 'run', 'build', '--', '--configuration', 'production', '--base-href=/'],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print_error("Build failed!")
            print(result.stderr)
            return False
            
        print_status("Production build complete")
        return True
        
    except Exception as e:
        print_error(f"Build error: {e}")
        return False

def copy_files_to_root():
    """Copy all built files to root directory"""
    print_info("Copying build files to root directory...")
    
    source_dir = Path('dist/lukasz-portfolio/browser')
    
    if not source_dir.exists():
        print_error(f"Build directory {source_dir} not found!")
        return False
    
    try:
        # Copy all files and directories
        for item in source_dir.iterdir():
            if item.is_file():
                shutil.copy2(item, '.')
            elif item.is_dir():
                dest_dir = Path(item.name)
                if dest_dir.exists():
                    shutil.rmtree(dest_dir)
                shutil.copytree(item, dest_dir)
        
        print_status("Files copied to root")
        return True
        
    except Exception as e:
        print_error(f"Copy error: {e}")
        return False

def ensure_translations():
    """Ensure i18n translations are in place"""
    print_info("Ensuring latest translations...")
    
    i18n_dir = Path('assets/i18n')
    source_i18n = Path('src/assets/i18n')
    
    # Always copy fresh translations from source
    if source_i18n.exists():
        # Remove old translations if they exist
        if i18n_dir.exists():
            shutil.rmtree(i18n_dir)
            print_info("Removed old translations")
        
        # Create directory and copy new files
        i18n_dir.mkdir(parents=True, exist_ok=True)
        for file in source_i18n.glob('*.json'):
            shutil.copy2(file, i18n_dir)
            print_status(f"Copied {file.name}")
        print_status("All translations updated")
    else:
        print_warning("No i18n source files found in src/assets/i18n")

def minify_html(content):
    """Simple HTML minification"""
    # Remove comments (except IE conditionals)
    content = re.sub(r'<!--(?!\[if).*?-->', '', content, flags=re.DOTALL)
    # Remove extra whitespace between tags
    content = re.sub(r'>\s+<', '><', content)
    # Remove leading/trailing whitespace per line
    content = '\n'.join(line.strip() for line in content.splitlines() if line.strip())
    return content

def fix_base_href():
    """Fix base href in index.html to use absolute path for GitHub Pages and minify"""
    print_info("Fixing base href and minifying HTML...")
    
    index_file = Path('index.html')
    
    if not index_file.exists():
        print_error("index.html not found!")
        return False
    
    try:
        content = index_file.read_text(encoding='utf-8')
        original_size = len(content)
        
        # Replace base href with absolute path for GitHub Pages user site
        content = re.sub(
            r'<base href="[^"]*">',
            '<base href="/">',
            content
        )
        
        # Minify HTML
        content = minify_html(content)
        new_size = len(content)
        
        index_file.write_text(content, encoding='utf-8')
        
        reduction = ((original_size - new_size) / original_size) * 100
        print_status(f"HTML minified (reduced by {reduction:.1f}%)")
        print_status("Base href updated to absolute path (/)")
        return True
        
    except Exception as e:
        print_error(f"Error fixing base href: {e}")
        return False

def compress_files():
    """Create gzip versions of large files for better performance"""
    print_info("Creating compressed versions...")
    
    compressed_count = 0
    total_saved = 0
    
    # Compress JS and CSS files
    for pattern in ['*.js', '*.css']:
        for file in Path('.').glob(pattern):
            if file.stat().st_size > 1024:  # Only compress files > 1KB
                gz_file = file.with_suffix(file.suffix + '.gz')
                
                with open(file, 'rb') as f_in:
                    with gzip.open(gz_file, 'wb', compresslevel=9) as f_out:
                        content = f_in.read()
                        f_out.write(content)
                
                original_size = file.stat().st_size
                compressed_size = gz_file.stat().st_size
                saved = original_size - compressed_size
                total_saved += saved
                compressed_count += 1
    
    if compressed_count > 0:
        print_status(f"Created {compressed_count} compressed files (saved {total_saved/1024:.1f} KB)")
    
    return compressed_count

def create_github_pages_files():
    """Create necessary files for GitHub Pages"""
    print_info("Creating GitHub Pages configuration...")
    
    # Create .nojekyll file
    Path('.nojekyll').touch()
    print_status(".nojekyll file created")
    
    # Create CNAME file if needed (uncomment and modify if you have a custom domain)
    # Path('CNAME').write_text('yourdomain.com')

def verify_deployment():
    """Verify all critical files are in place"""
    print_info("Verifying deployment files...\n")
    
    checks = {
        'index.html': Path('index.html').exists(),
        'CSS files': len(list(Path('.').glob('styles-*.css'))) > 0,
        'Main JS bundle': len(list(Path('.').glob('main-*.js'))) > 0,
        'JS chunks': len(list(Path('.').glob('chunk-*.js'))),
        'Assets folder': Path('assets').exists(),
        'Translations': Path('assets/i18n/en.json').exists() and Path('assets/i18n/pl.json').exists()
    }
    
    all_good = True
    
    for check, result in checks.items():
        if check == 'JS chunks':
            if result > 0:
                print(f"  ✓ {result} JavaScript chunks found")
            else:
                print(f"  ✗ No JavaScript chunks found!")
                all_good = False
        elif result:
            print(f"  ✓ {check}")
        else:
            print(f"  ✗ {check} MISSING!")
            all_good = False
    
    print()
    
    if all_good:
        print_status("All critical files verified")
    else:
        print_error("Some critical files are missing!")
    
    return all_good

def generate_report():
    """Generate deployment report"""
    print_info("Generating deployment report...\n")
    
    # Count files
    js_files = list(Path('.').glob('*.js'))
    css_files = list(Path('.').glob('*.css'))
    
    # Calculate sizes
    total_js_size = sum(f.stat().st_size for f in js_files) / 1024 / 1024
    total_css_size = sum(f.stat().st_size for f in css_files) / 1024
    
    print(f"  📦 JavaScript: {len(js_files)} files ({total_js_size:.2f} MB)")
    print(f"  🎨 CSS: {len(css_files)} files ({total_css_size:.1f} KB)")
    
    # Create deployment info file
    info_content = f"""
=====================================
GitHub Pages Deployment Info
=====================================
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Files deployed:
- index.html
- {len(js_files)} JavaScript files
- {len(css_files)} CSS files
- Assets folder with images and translations

To deploy to GitHub Pages:
1. git add .
2. git commit -m "🚀 Deploy to GitHub Pages"
3. git push

Your site will be available at:
https://[your-username].github.io/

To test locally:
- Python: python3 -m http.server 8080
- Node.js: node test-server.js
- Open: http://localhost:8080
"""
    
    Path('DEPLOYMENT_INFO.txt').write_text(info_content)
    print_status("\nDeployment info saved to DEPLOYMENT_INFO.txt")

def main():
    """Main execution function"""
    print_header()
    
    # Check if we're in the right directory
    if not Path('package.json').exists():
        print_error("package.json not found. Please run from project root.")
        sys.exit(1)
    
    # Step 1: Clean
    clean_directory()
    
    # Step 2: Build
    if not build_production():
        print_error("Build failed. Exiting.")
        sys.exit(1)
    
    # Step 3: Copy files
    if not copy_files_to_root():
        print_error("Failed to copy files. Exiting.")
        sys.exit(1)
    
    # Step 4: Ensure translations
    ensure_translations()
    
    # Step 5: Fix base href
    fix_base_href()
    
    # Step 6: Create GitHub Pages files
    create_github_pages_files()
    
    # Step 7: Compress files
    compress_files()
    
    # Step 8: Verify deployment
    if not verify_deployment():
        print_warning("Deployment may not work properly!")
    
    # Step 9: Generate report
    generate_report()
    
    # Final message
    print("\n" + "=" * 50)
    print("  ✨ DEPLOYMENT READY!")
    print("=" * 50 + "\n")
    
    print_status("Build minified and optimized")
    print_status("Files copied to root directory")
    print_status("Base href set to absolute path (/)")
    print_status("GitHub Pages configuration added")
    
    print("\n📋 Next steps:")
    print("   1. Test locally: python3 -m http.server 8080")
    print("   2. Commit changes: git add . && git commit -m '🚀 Deploy'")
    print("   3. Push to GitHub: git push\n")

if __name__ == "__main__":
    main()