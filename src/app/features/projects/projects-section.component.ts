import { Component, inject, computed, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

const PROOF: Record<string, any> = {
  en: {
    eyebrow: 'The proof', title: 'Not promises — systems.',
    s1flag: "In production · maintained by the bank's team", s1where: 'Natek · embedded at a bank',
    s1desc: "Sole engineer, end to end. Local vision + language models on the bank's own GPUs — extracting structured data from scanned financial statements. No document ever leaves the network. Built for EU AI Act readiness and GDPR.",
    s2flag: 'Built solo · Sold', s2where: 'A commercial product',
    s2desc: 'An AI scribe for veterinary clinics — it turns the conversation in the room into clinical documentation. Architected, built and shipped alone, end to end. Then sold.',
    rangeLabel: 'And the range —',
    r1: 'Single-file IDE · Git/GitHub client', r2: 'Art-studio site · shipped for a client', r3: 'Sheet-music player',
  },
  pl: {
    eyebrow: 'Dowód', title: 'Nie obietnice — systemy.',
    s1flag: 'Na produkcji · utrzymywany przez zespół banku', s1where: 'Natek · oddelegowany do banku',
    s1desc: 'Jedyny inżynier, end to end. Lokalne modele wizyjne i językowe na GPU banku — ekstrakcja danych ustrukturyzowanych ze skanów sprawozdań finansowych. Żaden dokument nie opuszcza sieci. Pod kątem EU AI Act i RODO.',
    s2flag: 'Zbudowany solo · Sprzedany', s2where: 'Produkt komercyjny',
    s2desc: 'AI-skryba dla klinik weterynaryjnych — zamienia rozmowę w gabinecie w dokumentację kliniczną. Zaprojektowany, zbudowany i wdrożony w pojedynkę, end to end. Potem sprzedany.',
    rangeLabel: 'A do tego zasięg —',
    r1: 'Jednoplikowe IDE · klient Git/GitHub', r2: 'Strona studia artystycznego · dla klienta', r3: 'Odtwarzacz nut',
  },
  de: {
    eyebrow: 'Der Beweis', title: 'Keine Versprechen — Systeme.',
    s1flag: 'In Produktion · gepflegt vom Bank-Team', s1where: 'Natek · in einer Bank',
    s1desc: 'Alleiniger Entwickler, end to end. Lokale Vision- und Sprachmodelle auf den GPUs der Bank — Extraktion strukturierter Daten aus gescannten Finanzberichten. Kein Dokument verlässt das Netzwerk. Für EU AI Act und DSGVO ausgelegt.',
    s2flag: 'Allein gebaut · Verkauft', s2where: 'Ein kommerzielles Produkt',
    s2desc: 'Ein KI-Schreiber für Tierkliniken — verwandelt das Gespräch im Raum in klinische Dokumentation. Allein konzipiert, gebaut und ausgeliefert, end to end. Dann verkauft.',
    rangeLabel: 'Und die Bandbreite —',
    r1: 'Single-File-IDE · Git/GitHub-Client', r2: 'Kunststudio-Website · für einen Kunden', r3: 'Notenplayer',
  },
};

/**
 * The Proof — system slabs, not a card grid.
 * Two monoliths (the bank Document AI, OpisAI) you scroll into one at a time,
 * then the range. Real systems, real links. Depth over breadth.
 */
@Component({
  selector: 'app-projects-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="proof" id="projects">
      <header class="proof__head animate-on-scroll">
        <span class="proof__eyebrow">{{ p().eyebrow }}</span>
        <h2 class="proof__title">{{ p().title }}</h2>
      </header>

      <article class="slab animate-on-scroll">
        <div class="slab__meta">
          <span class="slab__index">01</span>
          <span class="slab__flag">{{ p().s1flag }}</span>
        </div>
        <h3 class="slab__name">On-prem Document AI</h3>
        <p class="slab__where">{{ p().s1where }}</p>
        <p class="slab__desc">{{ p().s1desc }}</p>
        <p class="slab__tech">Python · PyTorch · Computer Vision (ViT) · Local LLMs (vLLM) · Structured Outputs</p>
      </article>

      <article class="slab slab--opisai animate-on-scroll">
        <div class="slab__meta">
          <span class="slab__index">02</span>
          <span class="slab__flag">{{ p().s2flag }}</span>
        </div>
        <h3 class="slab__name">OpisAI</h3>
        <p class="slab__where">{{ p().s2where }}</p>
        <p class="slab__desc">{{ p().s2desc }}</p>
        <p class="slab__tech">LLMs · Structured Outputs · Python · Full-stack</p>
        <a class="slab__link" href="https://guziczak.github.io/opisai" target="_blank" rel="noopener noreferrer">
          guziczak.github.io/opisai <span aria-hidden="true">→</span>
        </a>
        <!-- OpisAI's mascot — the desktop "bublak": a white medical bag with the cross
             cut out to the orb's gradient. Bounces like a ball (JS, see component). -->
        <span class="opisai-bubble" aria-hidden="true">
          <svg class="opisai-bubble__icon" viewBox="0 0 100 100">
            <mask id="opisaiBag">
              <rect x="38" y="24.5" width="24" height="14" rx="6.3" fill="#fff" />
              <rect x="20.9" y="33.4" width="58.2" height="43.7" rx="10.4" fill="#fff" />
              <rect x="43.5" y="28.6" width="13" height="6.5" rx="2.6" fill="#000" />
              <rect x="45.9" y="42.5" width="8.1" height="25.3" rx="2.4" fill="#000" />
              <rect x="37.3" y="51.1" width="25.3" height="8.1" rx="2.4" fill="#000" />
            </mask>
            <rect width="100" height="100" fill="#fff" mask="url(#opisaiBag)" />
          </svg>
        </span>
      </article>

      <div class="range animate-on-scroll">
        <span class="range__label">{{ p().rangeLabel }}</span>
        <div class="range__items">
          <a class="range__item" href="https://github.com/guziczak/ide" target="_blank" rel="noopener noreferrer">
            <b>ForgeIDE</b><span>{{ p().r1 }}</span>
          </a>
          <a class="range__item" href="https://guziczak.github.io/siekart" target="_blank" rel="noopener noreferrer">
            <b>Siek-Art</b><span>{{ p().r2 }}</span>
          </a>
          <a class="range__item" href="https://github.com/guziczak/noteplayer" target="_blank" rel="noopener noreferrer">
            <b>noteplayer</b><span>{{ p().r3 }}</span>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .proof {
        padding: clamp(5rem, 12vh, 9rem) clamp(1.5rem, 6vw, 6rem);
        background: transparent;
      }
      .proof__head { max-width: 70rem; margin: 0 auto clamp(2.5rem, 6vw, 4.5rem); }
      .proof__eyebrow {
        display: block;
        color: var(--color-primary);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        margin-bottom: 1rem;
      }
      .proof__title {
        font-size: clamp(1.8rem, 4vw, 2.8rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin: 0;
      }

      .slab {
        max-width: 70rem;
        margin: 0 auto;
        padding: clamp(2.5rem, 5vw, 4rem) 0;
        border-top: 1px solid var(--border-color);
      }
      .slab__meta {
        display: flex;
        align-items: baseline;
        gap: 1.2rem;
        margin-bottom: 1.2rem;
        flex-wrap: wrap;
      }
      .slab__index {
        font-family: var(--font-mono);
        color: var(--color-primary);
        font-size: 0.9rem;
        letter-spacing: 0.1em;
      }
      .slab__flag {
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .slab__name {
        font-size: clamp(2rem, 5.5vw, 3.4rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.02;
        color: var(--text-primary);
        margin: 0 0 0.5rem;
      }
      .slab__where {
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin: 0 0 1.4rem;
      }
      .slab__desc {
        max-width: 44rem;
        font-size: clamp(1rem, 1.6vw, 1.15rem);
        line-height: 1.75;
        color: var(--text-secondary);
        margin: 0 0 1.4rem;
      }
      .slab__tech {
        font-family: var(--font-mono);
        font-size: 0.82rem;
        letter-spacing: 0.02em;
        color: var(--text-tertiary);
        margin: 0;
      }
      .slab__link {
        display: inline-block;
        margin-top: 1.4rem;
        color: var(--color-primary);
        font-size: 0.95rem;
        text-decoration: none;
        transition: opacity 0.25s ease;
      }
      .slab__link:hover { opacity: 0.8; text-decoration: none; }
      .slab__link span { transition: transform 0.25s ease; display: inline-block; }
      .slab__link:hover span { transform: translateX(4px); }

      /* OpisAI's mascot — the desktop "bublak": a white medical bag (cross cut out to
         the orb's gradient). It bounces like a ball in the right half of the slab —
         constant velocity, clean wall reflections — driven by JS (see the component).
         CSS only sets the look and a no-JS resting spot on the right. */
      .slab--opisai { position: relative; overflow: hidden; }
      .opisai-bubble {
        position: absolute;
        left: 55%;
        top: 1rem;
        width: 4.4rem;
        height: 4.4rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background:
          radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 45%),
          linear-gradient(150deg, #2563eb, #0ea5e9);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.18),
          0 8px 24px rgba(37, 99, 235, 0.4),
          0 0 28px rgba(14, 165, 233, 0.32);
        pointer-events: none;
        z-index: 1;
        will-change: transform;
      }
      .opisai-bubble__icon { width: 62%; height: 62%; display: block; }
      @media (max-width: 640px) {
        .opisai-bubble { width: 3.6rem; height: 3.6rem; }
      }

      .range {
        max-width: 70rem;
        margin: clamp(2.5rem, 5vw, 4rem) auto 0;
        padding-top: clamp(2.5rem, 5vw, 4rem);
        border-top: 1px solid var(--border-color);
      }
      .range__label {
        display: block;
        color: var(--text-tertiary);
        font-size: 0.9rem;
        margin-bottom: 1.6rem;
      }
      .range__items {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: 1.5rem;
      }
      .range__item {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 1.2rem 1.4rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        text-decoration: none;
        transition: border-color 0.25s ease, transform 0.25s ease;
      }
      .range__item:hover {
        border-color: var(--border-color-dark);
        transform: translateY(-2px);
        text-decoration: none;
      }
      .range__item b { color: var(--text-primary); font-weight: 600; font-size: 1.05rem; }
      .range__item span { color: var(--text-tertiary); font-size: 0.85rem; }
    `,
  ],
})
export class ProjectsSectionComponent implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private languageService = inject(LanguageService);
  protected readonly p = computed(() => PROOF[this.languageService.currentLanguage()] ?? PROOF['en']);
  private raf = 0;

  /** OpisAI's mascot bounces like a ball in the RIGHT half of its slab: one constant
      velocity vector, reflected off the walls (the desktop app's idle-bounce). Plain
      rAF — no reduced-motion gate, no ViewChild — so it reliably runs. */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const el = this.host.nativeElement;
    const zone = el.querySelector('.slab--opisai') as HTMLElement | null;
    const bubble = el.querySelector('.opisai-bubble') as HTMLElement | null;
    if (!zone || !bubble) return;
    bubble.style.left = '0';
    bubble.style.top = '0';

    const SPEED = 1.2; // px/frame
    let x = 0, y = 0, vx = SPEED, vy = -SPEED * 0.78, init = false;
    const step = () => {
      const w = zone.clientWidth, h = zone.clientHeight, s = bubble.offsetWidth || 70;
      const minX = Math.round(w * 0.5);
      const maxX = Math.max(minX + 1, w - s - 4);
      const maxY = Math.max(1, h - s - 4);
      if (!init && w > 0 && h > 0) { x = (minX + maxX) / 2; y = maxY * 0.4; init = true; }
      if (init) {
        x += vx;
        y += vy;
        if (x <= minX) { x = minX; vx = SPEED; } else if (x >= maxX) { x = maxX; vx = -SPEED; }
        if (y <= 0) { y = 0; vy = SPEED * 0.78; } else if (y >= maxY) { y = maxY; vy = -(SPEED * 0.78); }
        bubble.style.transform = `translate(${x}px, ${y}px)`;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
