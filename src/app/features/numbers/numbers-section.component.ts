import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

const NUMBERS: Record<string, { big: string; small: string }[]> = {
  en: [
    { big: '2', small: 'LLM systems in production' },
    { big: 'SOLD', small: 'own AI product — OpisAI' },
    { big: '2016', small: 'real ML since — not since ChatGPT' },
    { big: '5+', small: 'years production engineering' },
  ],
  pl: [
    { big: '2', small: 'systemy LLM na produkcji' },
    { big: 'SPRZEDANE', small: 'własny produkt AI — OpisAI' },
    { big: '2016', small: 'prawdziwy ML od — nie od ChatGPT' },
    { big: '5+', small: 'lat inżynierii produkcyjnej' },
  ],
  de: [
    { big: '2', small: 'LLM-Systeme in Produktion' },
    { big: 'VERKAUFT', small: 'eigenes KI-Produkt — OpisAI' },
    { big: '2016', small: 'echtes ML seit — nicht seit ChatGPT' },
    { big: '5+', small: 'Jahre Produktionsengineering' },
  ],
};

/**
 * The Numbers — a dark band of hard, verifiable ammunition.
 * Only what's real: two LLM systems in prod, a sold product, ML since 2016,
 * 5+ years shipping. No invented volumes. This is where the manifesto cashes the check.
 */
@Component({
  selector: 'app-numbers-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="numbers" id="numbers">
      <div class="numbers__row">
        @for (n of nums(); track n.small) {
          <div class="num animate-on-scroll">
            <span class="num__big">{{ n.big }}</span>
            <span class="num__small">{{ n.small }}</span>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .numbers {
        padding: clamp(4rem, 9vh, 7rem) clamp(1.5rem, 6vw, 6rem);
        background: var(--bg-secondary);
        border-top: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
      }
      .numbers__row {
        max-width: 70rem;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: clamp(1.5rem, 4vw, 3rem);
      }
      .num {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .num__big {
        font-family: var(--font-mono);
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--color-primary);
      }
      .num__small {
        font-size: 0.9rem;
        line-height: 1.4;
        color: var(--text-secondary);
        max-width: 12rem;
      }
      @media (max-width: 720px) {
        .numbers__row { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 420px) {
        .numbers__row { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class NumbersSectionComponent {
  private languageService = inject(LanguageService);
  protected readonly nums = computed(
    () => NUMBERS[this.languageService.currentLanguage()] ?? NUMBERS['en'],
  );
}
