import {
  Component,
  signal,
  computed,
  OnInit,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-cv-print-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="print-page">
      <div class="print-header no-print">
        <div class="print-actions">
          <a routerLink="/cv" class="btn-action">
            <i class="fas fa-arrow-left"></i> Back to CV
          </a>
          <button (click)="printPage()" class="btn-action btn-primary">
            <i class="fas fa-print"></i> Print
          </button>
          <div class="language-switch">
            <button
              [class.active]="currentLang() === 'en'"
              (click)="switchLanguage('en')"
            >
              English
            </button>
            <button
              [class.active]="currentLang() === 'pl'"
              (click)="switchLanguage('pl')"
            >
              Polish
            </button>
          </div>
        </div>
      </div>

      <div class="cv-print-content">
        <div class="cv-iframe-wrapper">
          <iframe
            #cvFrame
            [src]="cvIframeUrl()"
            class="cv-iframe"
            title="CV"
          ></iframe>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .print-page {
        min-height: 100vh;
        background: #f5f5f5;
      }

      .print-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: white;
        padding: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        z-index: 100;
      }

      .print-actions {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .btn-action {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 20px;
        background: white;
        color: #333;
        border: 2px solid #ddd;
        border-radius: 6px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 14px;
      }

      .btn-action:hover {
        border-color: #0070f3;
        color: #0070f3;
      }

      .btn-action.btn-primary {
        background: #0070f3;
        color: white;
        border-color: #0070f3;
      }

      .btn-action.btn-primary:hover {
        background: #0050a0;
        border-color: #0050a0;
      }

      .language-switch {
        margin-left: auto;
        display: flex;
        gap: 10px;
      }

      .language-switch button {
        padding: 8px 16px;
        background: white;
        border: 2px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .language-switch button.active {
        background: #0070f3;
        color: white;
        border-color: #0070f3;
      }

      .cv-print-content {
        padding: 100px 20px 40px;
        max-width: 850px;
        margin: 0 auto;
      }

      .cv-iframe-wrapper {
        width: 100%;
        max-width: 794px;
        margin: 0 auto;
        aspect-ratio: 794 / 2246;
        background: white;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      .cv-iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }

      @media print {
        .no-print {
          display: none !important;
        }

        .cv-print-content {
          padding: 0;
          max-width: none;
        }

        .cv-iframe-wrapper {
          aspect-ratio: auto;
          height: 100vh;
          box-shadow: none;
          max-width: none;
        }

        body {
          margin: 0;
          padding: 0;
        }
      }

      @media (max-width: 768px) {
        .print-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .language-switch {
          margin-left: 0;
          justify-content: center;
        }
      }
    `,
  ],
})
export class CvPrintPageComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  @ViewChild('cvFrame') cvFrame?: ElementRef<HTMLIFrameElement>;

  currentLang = signal<'en' | 'pl'>('en');

  cvIframeUrl = computed<SafeResourceUrl>(() => {
    const path =
      this.currentLang() === 'en'
        ? '/cv-html/cv_fixed.html'
        : '/cv-html/cv_fixed_pl.html';
    return this.sanitizer.bypassSecurityTrustResourceUrl(path);
  });

  ngOnInit() {
    const savedLang = localStorage.getItem('cv-language') as 'en' | 'pl';
    if (savedLang) {
      this.currentLang.set(savedLang);
    }
  }

  switchLanguage(lang: 'en' | 'pl') {
    this.currentLang.set(lang);
    localStorage.setItem('cv-language', lang);
  }

  printPage() {
    const frame = this.cvFrame?.nativeElement;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } else {
      window.print();
    }
  }
}
