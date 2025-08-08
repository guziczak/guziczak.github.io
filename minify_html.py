#!/usr/bin/env python3
import os
import shutil
import sys
from pathlib import Path

def main():
    dist_paths = [
        'dist/lukasz-portfolio/browser',
        'dist/lukasz-portfolio',
        'dist/browser',
        'dist'
    ]
    
    dist_path = None
    for path in dist_paths:
        index_path = os.path.join(path, 'index.html')
        if os.path.exists(index_path):
            dist_path = path
            break
    
    if not dist_path:
        print("❌ Nie znaleziono folderu dist/. Najpierw uruchom: npm run build")
        sys.exit(1)
    
    print("📦 Kopiowanie plików z dist do głównego katalogu...")
    
    # Lista plików do skopiowania
    files_copied = 0
    
    # Kopiuj wszystkie pliki .js, .css, .html
    for file in os.listdir(dist_path):
        if file.endswith(('.js', '.css', '.html', '.ico', '.json', '.txt')):
            src = os.path.join(dist_path, file)
            dst = file
            with open(src, 'rb') as f_src:
                with open(dst, 'wb') as f_dst:
                    f_dst.write(f_src.read())
            print(f"  ✓ {file}")
            files_copied += 1
    
    # Kopiuj folder assets jeśli istnieje
    assets_src = os.path.join(dist_path, 'assets')
    if os.path.exists(assets_src):
        if os.path.exists('assets'):
            shutil.rmtree('assets')
        shutil.copytree(assets_src, 'assets')
        print(f"  ✓ assets/")
        files_copied += 1
    
    # Kopiuj folder data jeśli istnieje
    data_src = os.path.join(dist_path, 'data')
    if os.path.exists(data_src):
        if os.path.exists('data'):
            shutil.rmtree('data')
        shutil.copytree(data_src, 'data')
        print(f"  ✓ data/")
        files_copied += 1
    
    # Kopiuj folder translations jeśli istnieje w dist
    translations_src = os.path.join(dist_path, 'translations')
    if os.path.exists(translations_src):
        if os.path.exists('translations'):
            shutil.rmtree('translations')
        shutil.copytree(translations_src, 'translations')
        print(f"  ✓ translations/ (from dist)")
        files_copied += 1
    # Jeśli nie ma w dist, skopiuj z public
    elif os.path.exists('public/translations'):
        if os.path.exists('translations'):
            shutil.rmtree('translations')
        shutil.copytree('public/translations', 'translations')
        print(f"  ✓ translations/ (from public)")
        files_copied += 1
    
    # Kopiuj folder resources jeśli istnieje
    resources_src = os.path.join(dist_path, 'resources')
    if os.path.exists(resources_src):
        if os.path.exists('resources'):
            shutil.rmtree('resources')
        shutil.copytree(resources_src, 'resources')
        print(f"  ✓ resources/")
        files_copied += 1
    
    # Kopiuj foldery CV jeśli istnieją
    for cv_folder in ['cv_en', 'cv_pl']:
        cv_src = os.path.join(dist_path, cv_folder)
        if os.path.exists(cv_src):
            if os.path.exists(cv_folder):
                shutil.rmtree(cv_folder)
            shutil.copytree(cv_src, cv_folder)
            print(f"  ✓ {cv_folder}/")
            files_copied += 1
    
    # Skopiuj także pliki z public jeśli istnieją (dla fallback)
    if os.path.exists('public'):
        public_files = ['cv_en.pdf', 'cv_pl.pdf', 'manifest.json', 'favicon.ico']
        for file in public_files:
            src = os.path.join('public', file)
            if os.path.exists(src) and not os.path.exists(file):
                with open(src, 'rb') as f_src:
                    with open(file, 'wb') as f_dst:
                        f_dst.write(f_src.read())
                print(f"  ✓ {file} (from public)")
                files_copied += 1
    
    print(f"\n✅ Sukces! Skopiowano {files_copied} plików/folderów")
    print(f"\n🚀 Aplikacja jest gotowa do uruchomienia!")
    print(f"   Wszystkie pliki są w głównym katalogu z relatywnymi ścieżkami")
    print(f"   Możesz otworzyć index.html w dowolnej przeglądarce lub serwerze")

if __name__ == "__main__":
    main()