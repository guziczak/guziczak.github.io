import { Component, inject, computed } from '@angular/core';
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

      <article class="slab animate-on-scroll">
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
        background: var(--bg-primary);
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
export class ProjectsSectionComponent {
  private languageService = inject(LanguageService);
  protected readonly p = computed(() => PROOF[this.languageService.currentLanguage()] ?? PROOF['en']);
}
