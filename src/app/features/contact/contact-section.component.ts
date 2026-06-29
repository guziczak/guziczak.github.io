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
      <div class="exit__halo" aria-hidden="true"></div>
      <div class="exit__inner animate-on-scroll">
        <span class="exit__shaft" aria-hidden="true"></span>
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
      /* The apse. After the long descent you arrive here — the one place where light wins:
         a warm bronze bloom behind the call, a thin shaft of light falling into it. Ave Maria
         before the battle — still, sacred, the loudest quiet on the page. */
      .exit {
        position: relative;
        overflow: hidden;
        padding: clamp(8rem, 22vh, 15rem) clamp(1.5rem, 6vw, 6rem);
        background: transparent;
        text-align: center;
      }
      .exit__halo {
        position: absolute;
        left: 50%;
        top: 40%;
        transform: translate(-50%, -50%);
        width: min(900px, 125vw);
        aspect-ratio: 1;
        pointer-events: none;
        background: radial-gradient(
          circle,
          rgba(245, 206, 140, 0.16),
          rgba(56, 189, 248, 0.08) 40%,
          transparent 70%
        );
        filter: blur(4px);
      }
      .exit__inner {
        position: relative;
        max-width: 50rem;
        margin: 0 auto;
        transition-duration: 1.15s; /* a slower, more solemn rise than the rest of the page */
      }
      /* the candle — lux in tenebris made literal: a single flame in the dark nave,
         its light trailing down toward the call, its glow the halo on the apse. */
      .exit__shaft {
        position: relative;
        display: block;
        width: 2px;
        height: clamp(2.5rem, 8vh, 5rem);
        margin: 0 auto clamp(1.5rem, 4vh, 2.5rem);
        border-radius: 1px;
        transform-origin: bottom center;
        /* brightest just under the flame, fading down into the dark */
        background: linear-gradient(to bottom, rgba(245, 206, 140, 0.8), rgba(245, 206, 140, 0.04));
      }
      .exit__shaft::before {
        /* the flame */
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        width: 7px;
        height: 13px;
        transform: translateX(-50%);
        border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
        background: radial-gradient(
          circle at 50% 66%,
          #fff6e0,
          rgba(245, 206, 140, 0.92) 45%,
          rgba(245, 170, 80, 0) 76%
        );
        box-shadow: 0 0 14px 4px rgba(245, 206, 140, 0.5);
        transform-origin: 50% 100%;
        animation: candleFlicker 2.6s ease-in-out infinite;
      }
      @keyframes candleFlicker {
        0%, 100% { opacity: 0.85; transform: translateX(-50%) scaleY(1) scaleX(1); }
        45% { opacity: 1; transform: translateX(-50%) scaleY(1.14) scaleX(0.95); }
        72% { opacity: 0.9; transform: translateX(-50%) scaleY(0.95) scaleX(1.04); }
      }
      /* The candle fires only AFTER the whole exit is read in — text fully visible first,
         then (a beat later) the flame thrusts up the shaft and BLOOMS at the apex while the
         apse-halo catches the light. Lux ascending — "światełko do nieba". Plays once. */
      .exit__inner.active .exit__shaft {
        animation: shaftRise 0.95s cubic-bezier(0.16, 0.84, 0.3, 1) 1.35s both;
      }
      .exit__inner.active .exit__shaft::before {
        animation:
          flameLaunch 0.95s cubic-bezier(0.16, 0.84, 0.3, 1) 1.35s both,
          candleFlicker 2.6s ease-in-out 2.3s infinite;
      }
      .exit:has(.exit__inner.active) .exit__halo {
        animation: haloBloom 1.7s ease-out 1.5s both;
      }
      @keyframes shaftRise {
        0% { transform: scaleY(0); }
        68% { transform: scaleY(1.08); }
        100% { transform: scaleY(1); }
      }
      @keyframes flameLaunch {
        0% { transform: translateX(-50%) translateY(clamp(2.5rem, 8vh, 5rem)) scale(0.5); opacity: 0; filter: brightness(2.4); }
        12% { opacity: 1; }
        64% { transform: translateX(-50%) translateY(0) scale(1.65); opacity: 1; filter: brightness(2.4); }
        100% { transform: translateX(-50%) translateY(0) scale(1); filter: brightness(1); }
      }
      @keyframes haloBloom {
        0% { transform: translate(-50%, -50%) scale(0.82); filter: blur(4px) brightness(1); }
        45% { transform: translate(-50%, -50%) scale(1.16); filter: blur(4px) brightness(2.5); }
        100% { transform: translate(-50%, -50%) scale(1); filter: blur(4px) brightness(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .exit__shaft::before { animation: none; }
        .exit__inner.active .exit__shaft,
        .exit__inner.active .exit__shaft::before { animation: none; }
        .exit:has(.exit__inner.active) .exit__halo { animation: none; }
      }
      .exit__line {
        color: var(--text-tertiary);
        font-size: 1rem;
        margin: 0 0 0.8rem;
      }
      .exit__cta {
        font-size: clamp(2.8rem, 8vw, 5.5rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1;
        color: var(--text-primary);
        margin: 0 0 2.4rem;
        text-shadow: 0 0 48px rgba(245, 206, 140, 0.3);
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
