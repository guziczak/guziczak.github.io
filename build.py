#!/usr/bin/env python3
"""
ULTIMATE BUILD SCRIPT - Just run it, it does EVERYTHING
"""

import subprocess
import sys
import os
import shutil
import time
import gzip
import json
from pathlib import Path

# Colors for terminal output
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_step(emoji, text):
    """Print a build step"""
    print(f"\n{emoji} {BOLD}{text}{RESET}")

def print_success(text):
    """Print success message"""
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    """Print error message"""
    print(f"{RED}❌ {text}{RESET}")

def print_info(text):
    """Print info message"""
    print(f"{BLUE}ℹ️  {text}{RESET}")

def run_command(command, description, critical=True):
    """Run command and handle output"""
    print(f"   {YELLOW}$ {command}{RESET}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            check=True
        )
        print_success(f"{description} - Done!")
        return True
    except subprocess.CalledProcessError as e:
        if critical:
            print_error(f"{description} - FAILED!")
            print(f"   {RED}{e.stderr}{RESET}")
            sys.exit(1)
        else:
            print_info(f"{description} - Skipped (optional)")
            return False

def clean_everything():
    """Clean all build artifacts"""
    print_step("🧹", "CLEANING EVERYTHING")
    
    # Remove dist folder
    if Path("dist").exists():
        shutil.rmtree("dist")
        print_success("Removed dist folder")
    
    # Remove Angular cache
    cache_path = Path(".angular")
    if cache_path.exists():
        shutil.rmtree(cache_path)
        print_success("Removed Angular cache")
    
    # CLEAN ALL OLD CHUNKS AND BUILD FILES FROM ROOT
    print("   🗑️  Removing old build files from root...")
    patterns_to_delete = [
        "chunk-*.js",
        "chunk-*.js.gz",
        "main-*.js",
        "main-*.js.gz",
        "polyfills-*.js",
        "polyfills-*.js.gz",
        "styles-*.css",
        "styles-*.css.gz",
        "*.js.gz",
        "*.css.gz",
        "ngsw-worker.js",
        "ngsw-worker.js.gz",
        "safety-worker.js",
        "ngsw.json",
        "ngsw.json.gz",
        "index.html",
        "index.html.gz",
        "manifest.json",
        "manifest.json.gz"
    ]
    
    deleted_count = 0
    for pattern in patterns_to_delete:
        for file in Path(".").glob(pattern):
            if file.is_file():
                file.unlink()
                deleted_count += 1
    
    # Remove copied folders
    folders_to_remove = ["assets", "data", "translations", "resources", "cv_en", "cv_pl"]
    for folder in folders_to_remove:
        folder_path = Path(folder)
        if folder_path.exists() and folder_path.is_dir():
            # Check if it's not the source folder
            if not str(folder_path).startswith("src"):
                shutil.rmtree(folder_path)
                print(f"   🗑️  Removed folder: {folder}/")
    
    if deleted_count > 0:
        print_success(f"Cleaned {deleted_count} old build files from root")
    
    return True

def install_deps():
    """Install dependencies if needed"""
    print_step("📦", "CHECKING DEPENDENCIES")
    
    if not Path("node_modules").exists():
        run_command("npm ci", "Installing packages")
    else:
        print_info("Dependencies already installed")
    
    return True

def build_angular():
    """Build Angular in production mode"""
    print_step("🔨", "BUILDING ANGULAR APP")
    
    # Production build with base href for root
    build_cmd = 'npm run build -- --base-href "./"'
    
    run_command(build_cmd, "Building Angular")
    return True

def minify_json_files():
    """Minify all JSON files"""
    print_step("📄", "MINIFYING JSON FILES")
    
    dist_path = Path("dist/lukasz-portfolio/browser")
    count = 0
    saved = 0
    
    for json_file in dist_path.rglob("*.json"):
        try:
            original_size = json_file.stat().st_size
            
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
            
            new_size = json_file.stat().st_size
            if original_size > new_size:
                saved += (original_size - new_size)
                count += 1
        except:
            pass
    
    if count > 0:
        print_success(f"Minified {count} JSON files, saved {saved/1024:.1f} KB")
    return True

def create_gzip_files():
    """Create gzipped versions"""
    print_step("🗜️", "CREATING GZIP FILES")
    
    dist_path = Path("dist/lukasz-portfolio/browser")
    extensions = ['.js', '.css', '.html', '.json', '.svg', '.xml', '.txt']
    count = 0
    total_saved = 0
    
    for file_path in dist_path.rglob('*'):
        if file_path.is_file() and file_path.suffix in extensions:
            if file_path.suffix == '.gz':
                continue
            
            original_size = file_path.stat().st_size
            
            # Only compress files > 1KB
            if original_size > 1024:
                gz_path = file_path.with_suffix(file_path.suffix + '.gz')
                
                with open(file_path, 'rb') as f_in:
                    with gzip.open(gz_path, 'wb', compresslevel=9) as f_out:
                        f_out.write(f_in.read())
                
                compressed_size = gz_path.stat().st_size
                saved = original_size - compressed_size
                
                if saved > 0:
                    total_saved += saved
                    count += 1
    
    print_success(f"Created {count} gzip files, saved {total_saved/1024/1024:.2f} MB")
    return True

def copy_to_root():
    """Copy ALL build files to project root - EVERYTHING"""
    print_step("📋", "COPYING ENTIRE BUILD TO ROOT")
    
    browser_path = Path("dist/lukasz-portfolio/browser")
    
    if not browser_path.exists():
        print_error("Browser folder not found!")
        return False
    
    # Copy EVERYTHING from browser folder to root
    total_copied = 0
    
    # Copy all files in root of browser folder
    for item in browser_path.glob("*"):
        if item.is_file():
            shutil.copy2(item, Path(item.name))
            total_copied += 1
    
    # Copy essential folders with their entire structure
    essential_folders = ["assets", "data", "translations", "resources", "cv_en", "cv_pl"]
    
    for folder_name in essential_folders:
        src_folder = browser_path / folder_name
        if src_folder.exists():
            dst_folder = Path(folder_name)
            # Remove existing folder if it exists
            if dst_folder.exists() and dst_folder.is_dir():
                shutil.rmtree(dst_folder)
            # Copy entire folder
            shutil.copytree(src_folder, dst_folder)
            print(f"   📁 Copied folder: {folder_name}/")
    
    print(f"   📄 Copied all root files")
    print_success(f"Entire build copied to root - ready to serve!")
    return True

def print_summary():
    """Print build summary"""
    print_step("📊", "BUILD SUMMARY")
    
    dist_path = Path("dist/lukasz-portfolio/browser")
    
    if dist_path.exists():
        # Calculate sizes
        total_size = sum(f.stat().st_size for f in dist_path.rglob('*') if f.is_file())
        js_files = list(dist_path.glob("*.js"))
        css_files = list(dist_path.glob("*.css"))
        gz_files = list(dist_path.rglob("*.gz"))
        
        print(f"\n   📁 Build location: {BOLD}{dist_path}{RESET}")
        print(f"   📦 Total size: {BOLD}{total_size/1024/1024:.2f} MB{RESET}")
        print(f"   📜 JavaScript files: {len(js_files)}")
        print(f"   🎨 CSS files: {len(css_files)}")
        print(f"   🗜️  Gzip files: {len(gz_files)}")
        
        # Find largest files
        print(f"\n   {BOLD}Largest files:{RESET}")
        files_with_size = []
        for f in dist_path.rglob('*'):
            if f.is_file() and not f.suffix in ['.gz', '.br']:
                files_with_size.append((f.stat().st_size, f))
        
        files_with_size.sort(reverse=True)
        for size, path in files_with_size[:5]:
            rel_path = path.relative_to(dist_path)
            print(f"   - {rel_path}: {size/1024/1024:.2f} MB")

def main():
    """Main build process"""
    start_time = time.time()
    
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}🚀 ULTIMATE BUILD SCRIPT - NO BULLSHIT EDITION{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")
    
    steps = [
        clean_everything,
        install_deps,
        build_angular,
        minify_json_files,
        create_gzip_files,
        copy_to_root
    ]
    
    for step in steps:
        if not step():
            print_error("BUILD FAILED!")
            sys.exit(1)
    
    print_summary()
    
    elapsed = time.time() - start_time
    
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{GREEN}{BOLD}✅ BUILD COMPLETE!{RESET}")
    print(f"{BOLD}⏱️  Time: {elapsed:.1f} seconds{RESET}")
    print(f"{BOLD}🚀 Ready for deployment!{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(f"\n{YELLOW}⚠️  Build interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}💥 Unexpected error: {e}{RESET}")
        sys.exit(1)