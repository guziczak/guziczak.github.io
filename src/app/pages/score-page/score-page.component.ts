import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const CREDIT = 'Łukasz Guziczak & Claude Opus 4.6 · guziczak.github.io';
const PDF = '/swiatlo.pdf';

/**
 * The full score of "Lux in tenebris" — a real engraved PDF (LilyPond), generated from the same
 * note data (swiatlo.json) the browser synthesises, then served as a static file. No backend, no
 * canvas construction: the page just embeds the PDF and offers it for download.
 */
@Component({
  selector: 'app-score-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="score-page">
      <header class="score-head">
        <a routerLink="/" class="back">← <span>Wróć</span></a>
        <div class="titles">
          <h1>Lux in tenebris</h1>
          <p class="credit">{{ credit }}</p>
          <p class="sub">światło w ciemności — pełna partytura, wygrawerowana z danych utworu (LilyPond)</p>
        </div>
        <a class="download" [href]="pdf" download="Swiatlo-w-Ciemnosci.pdf" target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">⭳</span> Pobierz PDF
        </a>
      </header>

      <div class="doc-wrap">
        <iframe class="doc" [src]="safePdf" title="Światło w Ciemności — partytura"></iframe>
      </div>
    </div>
  `,
  styles: [
    `
      .score-page {
        min-height: 100vh;
        padding: clamp(5.5rem, 9vh, 7rem) clamp(1rem, 4vw, 3rem) 4rem;
        background:
          radial-gradient(1100px 500px at 70% -10%, rgba(56, 189, 248, 0.06), transparent 60%),
          var(--bg-primary);
        color: var(--text-primary);
      }
      .score-head {
        max-width: 1000px;
        margin: 0 auto 1.75rem;
        display: flex;
        align-items: flex-start;
        gap: 1.5rem;
      }
      .back {
        flex: 0 0 auto;
        margin-top: 0.4rem;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.95rem;
        letter-spacing: 0.02em;
        transition: color 0.2s ease, transform 0.2s ease;
      }
      .back:hover { color: var(--color-primary); transform: translateX(-3px); }
      .back span { margin-left: 0.2rem; }
      .titles { flex: 1 1 auto; min-width: 0; }
      .score-head h1 {
        font-size: clamp(2rem, 6vw, 3.4rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 0 0 0.35rem;
      }
      .credit {
        color: var(--color-primary);
        font-size: clamp(0.9rem, 2vw, 1.05rem);
        font-weight: 500;
        margin: 0 0 0.2rem;
      }
      .sub {
        color: var(--text-tertiary);
        font-style: italic;
        font-size: clamp(0.78rem, 1.8vw, 0.92rem);
        margin: 0;
      }
      .download {
        flex: 0 0 auto;
        margin-top: 0.3rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1.1rem;
        border-radius: 10px;
        background: var(--color-primary);
        color: #fff;
        text-decoration: none;
        font-size: 0.92rem;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 6px 18px rgba(37, 99, 235, 0.28);
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
      }
      .download:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 10px 24px rgba(37, 99, 235, 0.38); }
      .download span { font-size: 1.05rem; line-height: 1; }
      .doc-wrap {
        max-width: 1000px;
        margin: 0 auto;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28);
        background: #525659; /* PDF viewer gutter tone, so letterboxing looks intentional */
      }
      .doc {
        display: block;
        width: 100%;
        height: min(84vh, 1180px);
        border: 0;
      }
      @media (max-width: 700px) {
        .score-head { flex-wrap: wrap; }
        .download { order: 3; margin-top: 0.4rem; }
        .doc { height: 78vh; }
      }
    `,
  ],
})
export class ScorePageComponent {
  protected readonly credit = CREDIT;
  protected readonly pdf = PDF;
  protected readonly safePdf: SafeResourceUrl;

  constructor(sanitizer: DomSanitizer) {
    // #view=FitH -> the embedded viewer fits the page width on load
    this.safePdf = sanitizer.bypassSecurityTrustResourceUrl(PDF + '#view=FitH');
  }
}
