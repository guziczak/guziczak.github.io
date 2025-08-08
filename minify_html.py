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
    
    # Skopiuj także public jeśli istnieje (dla fallback)
    if os.path.exists('public'):
        public_files = ['cv_en.pdf', 'cv_pl.pdf', 'manifest.json', 'favicon.ico']
        for file in public_files:
            src = os.path.join('public', file)
            if os.path.exists(src) and not os.path.exists(file):
                with open(src, 'rb') as f_src:
                    with open(file, 'wb') as f_dst:
                        f_dst.write(f_src.read())
                print(f"  ✓ {file}")
                files_copied += 1
    
    # Kopiuj folder translations
    if os.path.exists('public/translations'):
        if os.path.exists('translations'):
            shutil.rmtree('translations')
        shutil.copytree('public/translations', 'translations')
        print(f"  ✓ translations/")
        files_copied += 1
    
    # Napraw ścieżki w index.html dla IntelliJ
    if os.path.exists('index.html'):
        with open('index.html', 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Zmień base href na pełną ścieżkę IntelliJ
        html = html.replace('<base href="/">', '<base href="/lukasz/portfolio-angular/lukasz-portfolio/">')
        
        # Dodaj pełne ścieżki dla IntelliJ
        html = html.replace('href="chunk-', 'href="/lukasz/portfolio-angular/lukasz-portfolio/chunk-')
        html = html.replace('src="polyfills-', 'src="/lukasz/portfolio-angular/lukasz-portfolio/polyfills-')
        html = html.replace('src="main-', 'src="/lukasz/portfolio-angular/lukasz-portfolio/main-')
        html = html.replace('href="styles-', 'href="/lukasz/portfolio-angular/lukasz-portfolio/styles-')
        
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(html)
        
        print("  ✓ Naprawiono ścieżki w index.html")
    
    # Napraw absolutne ścieżki w plikach JS
    print("  • Naprawianie ścieżek w plikach JavaScript...")
    intellij_base = '/lukasz/portfolio-angular/lukasz-portfolio'
    
    for file in os.listdir('.'):
        if file.endswith('.js'):
            with open(file, 'r', encoding='utf-8') as f:
                js_content = f.read()
            
            # Zamień absolutne ścieżki na pełne ścieżki IntelliJ
            # Różne formaty w minifikowanym kodzie
            replacements = [
                ('"/data/', f'"{intellij_base}/data/'),
                ("'/data/", f"'{intellij_base}/data/"),
                ('`/data/', f'`{intellij_base}/data/'),
                ('("/data/', f'("{intellij_base}/data/'),
                ("('/data/", f"('{intellij_base}/data/"),
                ('(`/data/', f'(`{intellij_base}/data/'),
                
                ('"/translations/', f'"{intellij_base}/translations/'),
                ("'/translations/", f"'{intellij_base}/translations/"),
                ('`/translations/', f'`{intellij_base}/translations/'),
                ('("/translations/', f'("{intellij_base}/translations/'),
                ("('/translations/", f"('{intellij_base}/translations/"),
                ('(`/translations/', f'(`{intellij_base}/translations/'),
                
                ('"/assets/', f'"{intellij_base}/assets/'),
                ("'/assets/", f"'{intellij_base}/assets/"),
                ('`/assets/', f'`{intellij_base}/assets/'),
                ('("/assets/', f'("{intellij_base}/assets/'),
                ("('/assets/", f"('{intellij_base}/assets/"),
                ('(`/assets/', f'(`{intellij_base}/assets/'),
            ]
            
            for old, new in replacements:
                js_content = js_content.replace(old, new)
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(js_content)
    
    print("  ✓ Naprawiono ścieżki w plikach JS")
    
    print(f"\n✅ Sukces! Skopiowano {files_copied} plików/folderów")
    print(f"\n🚀 Teraz możesz otworzyć index.html w IntelliJ!")
    print(f"   Wszystkie pliki są w głównym katalogu")

if __name__ == "__main__":
    main()