#!/usr/bin/env python3
import os
import shutil
import sys
from pathlib import Path

def safe_copy_file(src, dst):
    """Bezpiecznie kopiuje plik"""
    try:
        with open(src, 'rb') as f_src:
            with open(dst, 'wb') as f_dst:
                f_dst.write(f_src.read())
        return True
    except Exception as e:
        print(f"  ❌ Błąd kopiowania {Path(src).name}: {e}")
        return False

def safe_copy_directory(src, dst):
    """Bezpiecznie kopiuje katalog z backupem"""
    try:
        if os.path.exists(dst):
            backup_path = f"{dst}.backup"
            if os.path.exists(backup_path):
                shutil.rmtree(backup_path)
            shutil.move(dst, backup_path)
        
        shutil.copytree(src, dst)
        return True
    except Exception as e:
        print(f"  ❌ Błąd kopiowania katalogu {Path(src).name}: {e}")
        return False

def main():
    # Stała ścieżka dist
    dist_path = 'dist/lukasz-portfolio/browser'
    
    # Sprawdź czy istnieje folder dist
    if not os.path.exists(dist_path):
        # Sprawdź alternatywne ścieżki
        alt_paths = ['dist/lukasz-portfolio', 'dist/browser', 'dist']
        for path in alt_paths:
            if os.path.exists(os.path.join(path, 'index.html')):
                dist_path = path
                break
        else:
            print("❌ Nie znaleziono folderu dist/. Najpierw uruchom: npm run build")
            sys.exit(1)
    
    # Najpierw zaktualizuj base href w index.html w dist
    index_path = os.path.join(dist_path, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace('<base href="/">', '<base href="./">')
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✓ Zaktualizowano base href w index.html")
    
    print(f"📦 Kopiowanie plików z {dist_path}...")
    print("━" * 50)
    
    files_copied = 0
    
    # Kopiuj wszystkie pliki
    for file in os.listdir(dist_path):
        src = os.path.join(dist_path, file)
        
        if not os.path.isfile(src):
            continue
            
        dst = file
        
        if safe_copy_file(src, dst):
            print(f"  ✓ {file}")
            files_copied += 1
    
    # Katalogi do skopiowania
    directories = [
        'assets',
        'data', 
        'translations',
        'resources',
        'cv_en',
        'cv_pl'
    ]
    
    for dir_name in directories:
        src_dir = os.path.join(dist_path, dir_name)
        
        # Jeśli nie ma w dist, sprawdź public
        if not os.path.exists(src_dir) and dir_name == 'translations':
            src_dir = 'public/translations'
        
        if os.path.exists(src_dir):
            if safe_copy_directory(src_dir, dir_name):
                print(f"  ✓ {dir_name}/")
                files_copied += 1
    
    # Skopiuj pliki z public (fallback)
    if os.path.exists('public'):
        public_files = ['cv_en.pdf', 'cv_pl.pdf', 'manifest.json', 'favicon.ico']
        for file in public_files:
            src = os.path.join('public', file)
            if os.path.exists(src) and not os.path.exists(file):
                if safe_copy_file(src, file):
                    print(f"  ✓ {file} (from public)")
                    files_copied += 1
    
    # Podsumowanie
    print("━" * 50)
    print(f"\n✅ Sukces!")
    print(f"   📁 Skopiowano: {files_copied} plików/folderów")
    print(f"\n🚀 Aplikacja jest gotowa do uruchomienia!")
    print(f"   Angular już zoptymalizował pliki podczas build")
    print(f"   Wszystkie pliki są w głównym katalogu")

if __name__ == "__main__":
    main()