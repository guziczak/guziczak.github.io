import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CONTACT_CONFIG } from '../../core/config/contact.config';
import { LanguageService } from '../../core/services/language.service';

const EXIT: Record<string, { line: string; cta: string; cvText: string; cvNote: string }> = {
  en: { line: 'You read this far.', cta: "Let's build something.", cvText: 'The full CV follows.', cvNote: "(You won't need it.)" },
  pl: { line: 'Doczytałeś tak daleko.', cta: 'Zróbmy coś razem.', cvText: 'Pełne CV poniżej.', cvNote: '(Nie będzie ci potrzebne.)' },
  de: { line: 'Sie haben bis hierher gelesen.', cta: 'Lassen Sie uns etwas bauen.', cvText: 'Vollständiger Lebenslauf folgt.', cvNote: '(Sie werden ihn nicht brauchen.)' },
};

/**
 * The quiet exit — no form, no begging. A cold close, three direct contacts,
 * and the CV hidden in plain sight: "(You won't need it.)".
 */
@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="exit" id="contact">
      <div class="exit__inner animate-on-scroll">
        <p class="exit__line">{{ e().line }}</p>
        <h2 class="exit__cta">{{ e().cta }}</h2>

        <div class="exit__contacts">
          <a [href]="'mailto:' + contact.email">{{ contact.email }}</a>
          <span class="exit__sep">·</span>
          <a [href]="contact.github" target="_blank" rel="noopener noreferrer">github.com/guziczak</a>
          <span class="exit__sep">·</span>
          <a [href]="contact.linkedin" target="_blank" rel="noopener noreferrer">in/guziczak</a>
        </div>

        <a class="exit__cv" href="/cv" target="_blank" rel="noopener noreferrer">
          {{ e().cvText }} <span>{{ e().cvNote }}</span>
        </a>
      </div>
    </section>
  `,
  styles: [
    `
      .exit {
        padding: clamp(6rem, 16vh, 11rem) clamp(1.5rem, 6vw, 6rem);
        background: transparent;
        text-align: center;
      }
      .exit__inner { max-width: 50rem; margin: 0 auto; }
      .exit__line {
        color: var(--text-tertiary);
        font-size: 1rem;
        margin: 0 0 0.8rem;
      }
      .exit__cta {
        font-size: clamp(2.5rem, 7vw, 4.5rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1;
        color: var(--text-primary);
        margin: 0 0 2.2rem;
      }
      .exit__contacts {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 2.5rem;
        font-size: 1.05rem;
      }
      .exit__contacts a {
        color: var(--text-secondary);
        text-decoration: none;
        transition: color 0.25s ease;
      }
      .exit__contacts a:hover { color: var(--color-primary); text-decoration: none; }
      .exit__sep { color: var(--text-tertiary); }
      .exit__cv {
        display: inline-block;
        color: var(--text-tertiary);
        font-size: 0.95rem;
        text-decoration: none;
        transition: color 0.25s ease;
      }
      .exit__cv:hover { color: var(--text-secondary); text-decoration: none; }
      .exit__cv span { color: var(--text-tertiary); }
    `,
  ],
})
export class ContactSectionComponent {
  private languageService = inject(LanguageService);
  protected readonly contact = CONTACT_CONFIG;
  protected readonly e = computed(() => EXIT[this.languageService.currentLanguage()] ?? EXIT['en']);
}
