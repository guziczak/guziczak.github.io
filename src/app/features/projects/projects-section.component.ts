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
    s3flag: 'Built solo · 17 specialties', s3where: 'A multi-specialty scribe + NFZ billing',
    s3desc: 'The human-medicine sibling — one AI scribe across 17 specialties. Records the visit, transcribes offline (Whisper) with Doctor/Patient diarization, then drafts the documentation with ICD-10 diagnoses, ICD-9 procedures and ready NFZ point-scoring. Nothing leaves the machine.',
    rangeLabel: 'And the range —',
    r1: 'Single-file IDE · Git/GitHub client', r2: 'Art-studio site · shipped for a client', r3: 'Sheet-music player', r4: 'Claude Code / Codex session browser · single file',
  },
  pl: {
    eyebrow: 'Dowód', title: 'Nie obietnice — systemy.',
    s1flag: 'Na produkcji · utrzymywany przez zespół banku', s1where: 'Natek · oddelegowany do banku',
    s1desc: 'Jedyny inżynier, end to end. Lokalne modele wizyjne i językowe na GPU banku — ekstrakcja danych ustrukturyzowanych ze skanów sprawozdań finansowych. Żaden dokument nie opuszcza sieci. Pod kątem EU AI Act i RODO.',
    s2flag: 'Zbudowany solo · Sprzedany', s2where: 'Produkt komercyjny',
    s2desc: 'AI-skryba dla klinik weterynaryjnych — zamienia rozmowę w gabinecie w dokumentację kliniczną. Zaprojektowany, zbudowany i wdrożony w pojedynkę, end to end. Potem sprzedany.',
    s3flag: 'Zbudowany solo · 17 specjalizacji', s3where: 'Skryba wielospecjalizacyjny + rozliczenia NFZ',
    s3desc: 'Brat bliźniak dla medycyny człowieka — jeden AI-skryba w 17 specjalizacjach. Nagrywa wizytę, transkrybuje offline (Whisper) z rozróżnianiem Lekarz/Pacjent, i układa dokumentację z rozpoznaniami ICD-10, procedurami ICD-9 i gotową punktacją NFZ. Dane nie opuszczają komputera.',
    rangeLabel: 'A do tego zasięg —',
    r1: 'Jednoplikowe IDE · klient Git/GitHub', r2: 'Strona studia artystycznego · dla klienta', r3: 'Odtwarzacz nut', r4: 'Przeglądarka sesji Claude Code / Codex · jeden plik',
  },
  de: {
    eyebrow: 'Der Beweis', title: 'Keine Versprechen — Systeme.',
    s1flag: 'In Produktion · gepflegt vom Bank-Team', s1where: 'Natek · in einer Bank',
    s1desc: 'Alleiniger Entwickler, end to end. Lokale Vision- und Sprachmodelle auf den GPUs der Bank — Extraktion strukturierter Daten aus gescannten Finanzberichten. Kein Dokument verlässt das Netzwerk. Für EU AI Act und DSGVO ausgelegt.',
    s2flag: 'Allein gebaut · Verkauft', s2where: 'Ein kommerzielles Produkt',
    s2desc: 'Ein KI-Schreiber für Tierkliniken — verwandelt das Gespräch im Raum in klinische Dokumentation. Allein konzipiert, gebaut und ausgeliefert, end to end. Dann verkauft.',
    s3flag: 'Allein gebaut · 17 Fachgebiete', s3where: 'Multidisziplinärer Schreiber + NFZ-Abrechnung',
    s3desc: 'Das Pendant für die Humanmedizin — ein KI-Schreiber über 17 Fachgebiete. Nimmt den Besuch auf, transkribiert offline (Whisper) mit Arzt/Patient-Trennung und erstellt die Dokumentation mit ICD-10-Diagnosen, ICD-9-Prozeduren und fertiger NFZ-Punktebewertung. Nichts verlässt den Rechner.',
    rangeLabel: 'Und die Bandbreite —',
    r1: 'Single-File-IDE · Git/GitHub-Client', r2: 'Kunststudio-Website · für einen Kunden', r3: 'Notenplayer', r4: 'Claude-Code-/Codex-Sitzungsbrowser · eine Datei',
  },
};

/**
 * The Proof — system slabs, not a card grid.
 * Three systems (the bank Document AI, OpisAI, Wizyta) you scroll into one at a time,
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
        <div class="opisai-brand">
          <h3 class="slab__name">OpisAI</h3>
          <a class="opisai-bubble" href="https://guziczak.github.io/opisai"
             target="_blank" rel="noopener noreferrer" aria-label="OpisAI">
            <svg class="opisai-bubble__icon" viewBox="20 21 60 60" aria-hidden="true">
              <mask id="opisaiBag">
                <rect x="38" y="24.5" width="24" height="14" rx="6.3" fill="#fff" />
                <rect x="20.9" y="33.4" width="58.2" height="43.7" rx="10.4" fill="#fff" />
                <rect x="43.5" y="28.6" width="13" height="6.5" rx="2.6" fill="#000" />
                <rect x="45.9" y="42.5" width="8.1" height="25.3" rx="2.4" fill="#000" />
                <rect x="37.3" y="51.1" width="25.3" height="8.1" rx="2.4" fill="#000" />
              </mask>
              <rect width="100" height="100" fill="#fff" mask="url(#opisaiBag)" />
            </svg>
          </a>
        </div>
        <p class="slab__where">{{ p().s2where }}</p>
        <p class="slab__desc">{{ p().s2desc }}</p>
        <p class="slab__tech">LLMs · Structured Outputs · Python · Full-stack</p>
        <a class="slab__link" href="https://guziczak.github.io/opisai" target="_blank" rel="noopener noreferrer">
          guziczak.github.io/opisai <span aria-hidden="true">→</span>
        </a>
      </article>

      <article class="slab slab--wizyta animate-on-scroll">
        <div class="slab__meta">
          <span class="slab__index">03</span>
          <span class="slab__flag">{{ p().s3flag }}</span>
        </div>
        <div class="wizyta-brand">
          <h3 class="slab__name">Wizyta</h3>
          <a class="wizyta-bag" href="https://guziczak.github.io/wizyta"
             target="_blank" rel="noopener noreferrer" aria-label="Wizyta">
            <svg class="wizyta-bag__icon" viewBox="20 21 60 60" aria-hidden="true">
                <defs>
                  <linearGradient id="wizGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#3b82f6" />
                    <stop offset="1" stop-color="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="wizBagFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#ffffff" />
                    <stop offset="1" stop-color="#dbe6f5" />
                  </linearGradient>
                  <mask id="wizBag">
                    <rect x="38" y="24.5" width="24" height="14" rx="6.3" fill="#fff" />
                    <rect x="20.9" y="33.4" width="58.2" height="43.7" rx="10.4" fill="#fff" />
                    <rect x="43.5" y="28.6" width="13" height="6.5" rx="2.6" fill="#000" />
                  </mask>
                </defs>
                <rect width="100" height="100" fill="url(#wizBagFill)" mask="url(#wizBag)" />
                <rect x="45.9" y="42.5" width="8.1" height="25.3" rx="2.4" fill="url(#wizGrad)" />
                <rect x="37.3" y="51.1" width="25.3" height="8.1" rx="2.4" fill="url(#wizGrad)" />
              </svg>
          </a>
        </div>
        <p class="slab__where">{{ p().s3where }}</p>
        <p class="slab__desc">{{ p().s3desc }}</p>
        <p class="slab__tech">Offline STT (Whisper) · Diarization · RAG (OpenVINO) · ICD-10/ICD-9/NFZ · LLMs · Python</p>
        <a class="slab__link" href="https://guziczak.github.io/wizyta" target="_blank" rel="noopener noreferrer">
          guziczak.github.io/wizyta <span aria-hidden="true">→</span>
        </a>
      </article>

      <div class="range animate-on-scroll">
        <span class="range__label">{{ p().rangeLabel }}</span>
        <div class="range__items">
          <a class="range__item" href="https://github.com/guziczak/ide" target="_blank" rel="noopener noreferrer">
            <b>ForgeIDE</b><span>{{ p().r1 }}</span>
          </a>
          <a class="range__item" href="https://zofiasiek.pl" target="_blank" rel="noopener noreferrer">
            <b>Siek-Art</b><span>{{ p().r2 }}</span>
          </a>
          <a class="range__item" href="https://github.com/guziczak/noteplayer" target="_blank" rel="noopener noreferrer">
            <b>noteplayer</b><span>{{ p().r3 }}</span>
          </a>
          <a class="range__item" href="https://github.com/guziczak/przegladaczka" target="_blank" rel="noopener noreferrer">
            <b>przeglądaczka</b><span>{{ p().r4 }}</span>
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
      /* OpisAI — the title row is the same blue bar as Wizyta. The mascot is a ball that BOUNCES
         off the bar's top edge (the bar is the floor). Headroom above the bar is its court. */
      .slab--opisai { position: relative; overflow: visible; }
      .opisai-brand {
        position: relative;
        display: flex;
        align-items: center;
        padding: 0.4rem 0.6rem 0.4rem 1.2rem;
        background: linear-gradient(90deg, #286cff, #1d4ed8);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 10px 26px rgba(37, 99, 235, 0.30);
        margin: 6rem 0 0.9rem;
      }
      .opisai-brand .slab__name { margin: 0; color: #fff; line-height: 1.05; }
      .opisai-bubble {
        position: absolute;
        /* Centred at 46% of the bar (via negative margin, so the bounce's translate stays free),
           lined up with Wizyta's bag which uses the same 46%. */
        left: 46%;
        margin-left: -2.2rem; /* half of width */
        bottom: calc(100% - 0.6rem); /* rests on the bar's top edge — the floor it bounces off */
        width: 4.4rem;
        height: 4.4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transform-origin: 50% 100%;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0) 70%),
          radial-gradient(circle at 39% 36%, #286cff, #2563eb 55%, #225bd6);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.10),
          0 16px 28px rgba(15, 23, 42, 0.12),
          0 6px 12px rgba(15, 23, 42, 0.14);
        pointer-events: auto;
        cursor: pointer;
        text-decoration: none;
        z-index: 2;
        will-change: translate, scale;
        transition: box-shadow 0.25s ease, filter 0.25s ease, transform 0.2s ease;
        animation: opisaiDunk 1.4s infinite;
      }
      /* Catch the ball: hover/focus pauses the bounce so the moving target holds still, then bulges. */
      .opisai-bubble:hover,
      .opisai-bubble:focus-visible {
        animation-play-state: paused;
        transform: scale(1.14);
        filter: brightness(1.12);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.22),
          0 18px 34px rgba(15, 23, 42, 0.18),
          0 8px 16px rgba(15, 23, 42, 0.16);
      }
      .opisai-bubble:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      .opisai-bubble__icon { width: 2.6rem; height: 2.6rem; display: block; }
      /* Wizyta — the whole title row IS the blue bar (a pill). "Wizyta" (white) sits ON it at the
         left, the medical bag ON it at the right end. */
      .slab--wizyta { position: relative; }
      .wizyta-brand {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.4rem 0.6rem 0.4rem 1.2rem;
        border-radius: 0;
        background: linear-gradient(90deg, #286cff, #1d4ed8);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 10px 26px rgba(37, 99, 235, 0.30);
        margin-bottom: 0.9rem;
      }
      .wizyta-brand .slab__name { margin: 0; color: #fff; line-height: 1.05; }
      .wizyta-bag {
        position: absolute;
        /* Same 46% centre as OpisAI's ball, so the two mascots line up in a vertical column. */
        left: 46%;
        margin-left: -1.2rem; /* half of the 2.4rem icon */
        top: 50%;
        margin-top: -1.2rem;
        display: block;
        line-height: 0;
        text-decoration: none;
        filter: drop-shadow(0 2px 5px rgba(15, 23, 42, 0.30));
        transition: transform 0.2s ease;
      }
      .wizyta-bag:hover { transform: scale(1.08); }
      .wizyta-bag:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
        border-radius: 8px;
      }
      .wizyta-bag__icon { width: 2.4rem; height: 2.4rem; display: block; }
      @media (max-width: 640px) {
        .wizyta-brand { padding: 0.35rem 0.5rem 0.35rem 0.95rem; }
        .wizyta-bag { margin-left: -1rem; margin-top: -1rem; }
        .wizyta-bag__icon { width: 2rem; height: 2rem; }
      }
      /* A basketball: falls under "gravity" (accelerating), hits the floor and squashes,
         then springs back up (decelerating). Purely vertical, in place — beside the title.
         transform-origin is the bottom, so the squash flattens against the floor. */
      /* Bounce uses the INDIVIDUAL transform properties (translate/scale), leaving the
         \`transform\` shorthand free for the hover bulge to compose on top. */
      @keyframes opisaiDunk {
        0%   { translate: 0 -2rem; scale: 1 1; animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
        43%  { translate: 0 0; scale: 1 1; animation-timing-function: ease-out; }
        48%  { translate: 0 0; scale: 1.14 0.82; animation-timing-function: ease-in; }
        54%  { translate: 0 0; scale: 1 1; animation-timing-function: cubic-bezier(0, 0.4, 0.5, 1); }
        100% { translate: 0 -2rem; scale: 1 1; }
      }
      @media (max-width: 640px) {
        .opisai-bubble { width: 3.2rem; height: 3.2rem; margin-left: -1.6rem; }
        .opisai-bubble__icon { width: 1.95rem; height: 1.95rem; }
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
export class ProjectsSectionComponent {
  private languageService = inject(LanguageService);
  protected readonly p = computed(() => PROOF[this.languageService.currentLanguage()] ?? PROOF['en']);
}
