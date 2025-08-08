import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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
        @if (currentLang() === 'en') {
          <div class="cv-pages">
            <div class="cv-page-wrapper">
              <img
                src="/cv_en/Slide1.PNG"
                alt="CV Page 1"
                class="cv-page-image"
              />
            </div>
            <div class="page-break"></div>
            <div class="cv-page-wrapper">
              <img
                src="/cv_en/Slide2.PNG"
                alt="CV Page 2"
                class="cv-page-image"
              />
            </div>
          </div>
        } @else {
          <div class="cv-pages">
            <div class="cv-page-wrapper">
              <img
                src="/cv_pl/Slide1.PNG"
                alt="CV Strona 1"
                class="cv-page-image"
              />
            </div>
            <div class="page-break"></div>
            <div class="cv-page-wrapper">
              <img
                src="/cv_pl/Slide2.PNG"
                alt="CV Strona 2"
                class="cv-page-image"
              />
            </div>
          </div>
        }
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
        padding-top: 100px;
        max-width: 850px;
        margin: 0 auto;
      }

      .cv-pages {
        background: white;
        padding: 20px;
      }

      .cv-page-wrapper {
        margin-bottom: 40px;
        page-break-after: always;
      }

      .cv-page-image {
        width: 100%;
        height: auto;
        display: block;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      .page-break {
        display: block;
        height: 40px;
      }

      @media print {
        .no-print {
          display: none !important;
        }

        .cv-print-content {
          padding-top: 0;
        }

        .cv-pages {
          padding: 0;
          background: none;
        }

        .cv-page-wrapper {
          margin-bottom: 0;
          page-break-after: always;
        }

        .cv-page-image {
          box-shadow: none;
          max-height: 100vh;
          width: auto;
        }

        .page-break {
          page-break-after: always;
          height: 0;
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
  currentLang = signal<'en' | 'pl'>('en');

  ngOnInit() {
    // Get language from localStorage or default to 'en'
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
    window.print();
  }
}
