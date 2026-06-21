import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
        <div class="num animate-on-scroll">
          <span class="num__big">2</span>
          <span class="num__small">LLM systems in production</span>
        </div>
        <div class="num animate-on-scroll">
          <span class="num__big">SOLD</span>
          <span class="num__small">own AI product — OpisAI</span>
        </div>
        <div class="num animate-on-scroll">
          <span class="num__big">2016</span>
          <span class="num__small">real ML since — not since ChatGPT</span>
        </div>
        <div class="num animate-on-scroll">
          <span class="num__big">5+</span>
          <span class="num__small">years production engineering</span>
        </div>
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
export class NumbersSectionComponent {}
