import { observeCvFrame } from '../cv-frame-layout';
import {
  Component,
  computed,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { LanguageService } from '../../core/services/language.service';

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
          <a [href]="cvPdfUrl()" download class="btn-action">
            <i class="fas fa-download"></i> {{ downloadLabels().pdf }}
          </a>
          <a [href]="cvPrintPdfUrl()" download class="btn-action btn-primary">
            <i class="fas fa-print"></i> {{ downloadLabels().print }}
          </a>
          <button (click)="printPage()" class="btn-action">
            <i class="fas fa-print"></i> Print
          </button>
        </div>
      </div>

      <div class="cv-print-content">
        <div class="cv-iframe-wrapper" #cvWrapper>
          <iframe
            #cvFrame
            [src]="cvIframeUrl()"
            class="cv-iframe"
            title="CV"
            (load)="fitCv()"
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
        /* The global nav (navigation.component) is fixed at top, 60px tall.
           Offset the page below it so our toolbar isn't hidden under it. */
        padding-top: 60px;
      }

      .print-header {
        background: white;
        padding: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .print-actions {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-wrap: wrap;
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
        padding: 40px 20px;
        max-width: 850px;
        margin: 0 auto;
      }

      .cv-iframe-wrapper {
        position: relative;
        width: 100%;
        max-width: 794px;
        min-height: 200px;
        margin: 0 auto;
        overflow: hidden;
        background: white;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }

      .cv-iframe {
        width: 100%;
        height: 1123px;
        border: 0;
        display: block;
        transform-origin: top left;
      }

      @media print {
        .no-print {
          display: none !important;
        }

        .print-page {
          padding-top: 0;
        }

        .cv-print-content {
          padding: 0;
          max-width: none;
        }

        .cv-iframe-wrapper {
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
        .print-page {
          padding-top: 60px;
        }

        .print-header {
          padding: 12px;
        }

        .print-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .btn-action {
          justify-content: center;
        }

        .cv-print-content {
          padding: 16px 12px;
        }
      }
    `,
  ],
})
export class CvPrintPageComponent implements OnInit, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private title = inject(Title);
  private previousTitle?: string;
  private languageService = inject(LanguageService);
  @ViewChild('cvFrame') cvFrame?: ElementRef<HTMLIFrameElement>;
  @ViewChild('cvWrapper') cvWrapper?: ElementRef<HTMLElement>;

  private stopFrameLayout?: () => void;

  // Reactive: follows the global language (en/pl/de) from LanguageService
  currentLang = this.languageService.currentLanguage;

  downloadLabels = computed(
    () =>
      ({
        pl: { pdf: 'Pobierz PDF', print: 'PDF do druku' },
        en: { pdf: 'Download PDF', print: 'Print PDF' },
        de: { pdf: 'PDF herunterladen', print: 'Druck-PDF' },
      })[this.currentLang()],
  );
  cvPdfUrl = computed(() => '/cv_' + this.currentLang() + '.pdf');
  cvPrintPdfUrl = computed(() => '/cv_' + this.currentLang() + '_print.pdf');

  private static readonly CV_HTML_BY_LANG: Record<string, string> = {
    en: '/cv-html/cv_fixed.html?print=1',
    pl: '/cv-html/cv_fixed_pl.html?print=1',
    de: '/cv-html/cv_fixed_de.html?print=1',
  };

  cvIframeUrl = computed<SafeResourceUrl>(() => {
    const path =
      CvPrintPageComponent.CV_HTML_BY_LANG[this.currentLang()] ??
      CvPrintPageComponent.CV_HTML_BY_LANG['en'];
    return this.sanitizer.bypassSecurityTrustResourceUrl(path);
  });

  ngOnInit() {
    this.previousTitle = this.title.getTitle();
    this.title.setTitle('Łukasz Guziczak — AI Engineer | CV do druku');
  }

  ngOnDestroy(): void {
    if (this.previousTitle !== undefined) this.title.setTitle(this.previousTitle);
    this.stopFrameLayout?.();
  }

  fitCv(): void {
    this.stopFrameLayout?.();
    const frame = this.cvFrame?.nativeElement;
    const wrapper = this.cvWrapper?.nativeElement;
    if (frame && wrapper)
      this.stopFrameLayout = observeCvFrame(frame, wrapper, true);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.fitCv();
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
