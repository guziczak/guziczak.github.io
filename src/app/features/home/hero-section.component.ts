import { Component, inject, signal, computed, effect, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';
import { LanguageService } from '../../core/services/language.service';
import { CONTACT_CONFIG } from '../../core/config/contact.config';
import { createSwiatlo, SwiatloPlayer } from './swiatlo-player';
import { saveHandoff, swiatloBus } from './swiatlo-sync';
import { StaffVisualizerComponent } from './staff-visualizer.component';

const MANIFESTO: Record<string, any> = {
  en: {
    stamp: ['In the lab since 2016. In production since 2024. ', 'Currently embedded at a bank — on-prem, regulated.'], stampPunch: 'Not since ChatGPT.',
    lead: 'They say AI loses the thread past 1,000 lines of code.',
    punch: 'Cute',
    num: '20,000',
    reframeA: "That's where I start — ", reframeB: ' lines.', reframeTail: ['One file.', 'One person.'],
    proof1: ['A month to a working PoC.', 'Three to production.', 'No team.'],
    proof2: ['Their teams maintain it.', "I'm on the next."],
    rest: 'The code says the rest.',
    enter: 'Enter', cvText: 'The full CV', cvNote: "(You won't need it.)",
  },
  pl: {
    stamp: ['Eksperymenty od 2016. Produkcja od 2024. ', 'Teraz w banku — on-prem, zaryglowany regulacjami.'], stampPunch: 'Nie od ChatGPT.',
    lead: 'Mówią, że AI gubi wątek po 1000 liniach kodu.',
    punch: 'Urocze',
    num: '20 000',
    reframeA: '', reframeB: ' linii — to dopiero rozgrzewka.', reframeTail: ['Jeden plik.', 'Jeden człowiek.'],
    proof1: ['Miesiąc do działającego PoC.', 'Trzy do produkcji.', 'Bez zespołu.'],
    proof2: ['Potem utrzymują to ich zespoły.', 'Ja już robię następny.'],
    rest: 'Resztę mówi kod.',
    enter: 'Wejdź', cvText: 'Pełne CV', cvNote: '(Nie będzie ci potrzebne.)',
  },
  de: {
    stamp: ['Im Labor seit 2016. In Produktion seit 2024. ', 'Derzeit in einer Bank — On-Prem, reguliert.'], stampPunch: 'Nicht seit ChatGPT.',
    lead: 'Sie sagen, KI verliert den Faden nach 1.000 Zeilen Code.',
    punch: 'Niedlich',
    num: '20.000',
    reframeA: 'Da fange ich an — ', reframeB: ' Zeilen.', reframeTail: ['Eine Datei.', 'Eine Person.'],
    proof1: ['Ein Monat bis zum funktionierenden PoC.', 'Drei bis zur Produktion.', 'Kein Team.'],
    proof2: ['Ihre Teams pflegen es.', 'Ich bin schon beim nächsten.'],
    rest: 'Den Rest sagt der Code.',
    enter: 'Eintreten', cvText: 'Der vollständige Lebenslauf', cvNote: '(Sie werden ihn nicht brauchen.)',
  },
};

/**
 * The Manifesto — the fold. The CV cover, alive.
 * Obsidian canvas, a whisper of real code drifting behind, cold engraved text.
 * Copy is English-locked on purpose: the punch lives in the wordplay.
 */
@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule, StaffVisualizerComponent],
  template: `
    <section class="manifesto" id="home" [class.is-seq]="animate()">
      <!-- Signature: a whisper of real code, drifting, near-invisible -->
      <div class="manifesto__code" aria-hidden="true">
        <pre>{{ codeLoop }}</pre>
      </div>

      <div class="manifesto__stamp reveal" [class.is-in]="step() >= 1">
        <span class="manifesto__kicker">Łukasz Guziczak · AI Engineer</span>
        <span>{{ m().stamp[0] }}<strong class="manifesto__stamp-punch">{{ m().stampPunch }}</strong></span>
        <span>{{ m().stamp[1] }}</span>
      </div>

      <div class="manifesto__inner">
        <p class="manifesto__lead reveal" [class.is-in]="step() >= 2">{{ m().lead }}</p>
        <p class="manifesto__punch reveal" [class.is-in]="step() >= 3"><span class="manifesto__type">{{ typed() }}</span><span class="manifesto__dot" [class.manifesto__dot--period]="typedDone()" aria-hidden="true"></span></p>
        <p class="manifesto__reframe" [class.is-in]="step() >= 4">
          <span class="manifesto__reframe-line">{{ m().reframeA }}<span class="manifesto__num">{{ m().num }}</span>{{ m().reframeB }}</span>
          <span class="manifesto__reframe-line" *ngFor="let l of m().reframeTail">{{ l }}</span>
        </p>
        <p class="manifesto__proof" [class.is-in]="step() >= 5">
          <span class="manifesto__proof-line" *ngFor="let s of m().proof1">{{ s }}</span>
        </p>
        <div class="manifesto__coda">
          <p class="manifesto__proof" [class.is-in]="step() >= 6">
            <span class="manifesto__proof-line" *ngFor="let s of m().proof2">{{ s }}</span>
          </p>
          <div class="manifesto__act reveal" [class.is-in]="step() >= 8">
            <button (click)="enter()" class="manifesto__enter">
              {{ m().enter }} <span class="manifesto__arrow">↓</span>
            </button>
            <a href="/cv" target="_blank" rel="noopener noreferrer" class="manifesto__cv">
              {{ m().cvText }} <span class="manifesto__cv-note">{{ m().cvNote }}</span>
            </a>
          </div>
        </div>
        <p class="manifesto__rest reveal" [class.is-in]="step() >= 7">{{ m().rest }}</p>
      </div>

      <footer class="manifesto__footer">
        <div class="manifesto__social reveal" [class.is-in]="step() >= 8">
          <a [href]="contact.github" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fab fa-github"></i></a>
          <a [href]="contact.linkedin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
          <a [href]="'mailto:' + contact.email" aria-label="Email"><i class="fas fa-envelope"></i></a>
        </div>

        <button class="manifesto__music reveal" type="button"
                [class.is-in]="step() >= 8"
                [class.is-playing]="musicOn()" (click)="toggleMusic()"
                [attr.aria-pressed]="musicOn()"
                aria-label="Play 'Lux in tenebris' (światło w ciemności) — composed by Łukasz Guziczak &amp; Opus 4.6, synthesised live">
          <span class="manifesto__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="manifesto__music-text">
            <span class="manifesto__music-title">Lux in tenebris</span>
            <span class="manifesto__music-credit">Łukasz Guziczak &amp; Opus 4.6</span>
          </span>
        </button>
      </footer>
    </section>
    <app-staff-visualizer [notes]="notes || []" [player]="player" [active]="musicOn()" [beatMs]="beatMs" [leadInSec]="leadInSec" />
  `,
  styles: [
    `
      .manifesto {
        position: relative;
        min-height: 100dvh;
        /* Three rows — stamp / manifesto / footer — all in normal flow, so the badges
           can never collide with the text. The middle (1fr) row swallows the slack and
           centres its content; when the manifesto is taller than the screen the whole
           section simply grows and the page scrolls. */
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: clamp(1.5rem, 4vh, 3rem);
        padding: clamp(2rem, 5vh, 3.5rem) clamp(2rem, 6vw, 6rem);
        overflow: hidden;
        background:
          radial-gradient(1200px 600px at 70% -10%, rgba(56, 189, 248, 0.06), transparent 60%),
          var(--bg-primary);
      }

      /* Whisper of drifting code */
      .manifesto__code {
        position: absolute;
        inset: -10% 0;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
        opacity: 0.05;
        -webkit-mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent);
        mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent);
      }
      .manifesto__code pre {
        margin: 0;
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.55;
        color: var(--color-primary-light);
        white-space: pre;
        animation: drift 90s linear infinite;
      }
      @keyframes drift {
        from { transform: translateY(0); }
        to { transform: translateY(-50%); }
      }

      .manifesto__stamp {
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.78rem;
        letter-spacing: 0.02em;
        color: var(--text-tertiary);
      }
      .manifesto__kicker {
        color: var(--color-primary);
        font-weight: 700;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 0.55rem;
      }
      /* The punchline of the stamp — emphasised, but measured (the stamp stays quiet). */
      .manifesto__stamp-punch {
        font-weight: 700;
        color: var(--text-secondary);
      }

      .manifesto__inner {
        position: relative;
        z-index: 2;
        max-width: 56rem;
        /* Lives in the middle (1fr) row and centres in whatever slack it's given. */
        align-self: center;
      }
      /* Guided reveal — each line settles into focus on its own beat (driven by \`step\`).
         Active only while the JS sequence runs (.is-seq); without it (no-JS / SSR /
         reduced motion) everything is visible, so the manifesto is always readable. */
      .manifesto.is-seq .reveal {
        opacity: 0;
        transform: translateY(12px);
        filter: blur(4px);
        pointer-events: none;
        transition:
          opacity 0.7s ease,
          transform 0.7s cubic-bezier(0.33, 1, 0.68, 1),
          filter 0.7s ease;
      }
      .manifesto.is-seq .reveal.is-in {
        opacity: 1;
        transform: none;
        filter: none;
        pointer-events: auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .manifesto.is-seq .reveal {
          opacity: 1;
          transform: none;
          filter: none;
          transition: none;
          pointer-events: auto;
        }
      }


      /* styles.scss blankets every p/span/a/button on the page with
         \`animation: fadeInUp … forwards\`, which pins them to opacity:1 and (being an animation)
         overrides the step reveal — text leaked through the gate. Cancel it on the manifesto's
         sequenced elements so \`step\` owns visibility here, through transitions, not a global fade. */
      .manifesto.is-seq .reveal,
      .manifesto.is-seq .manifesto__reframe,
      .manifesto.is-seq .manifesto__reframe-line,
      .manifesto.is-seq .manifesto__num,
      .manifesto.is-seq .manifesto__proof,
      .manifesto.is-seq .manifesto__proof-line {
        animation: none;
      }
      .manifesto__lead {
        font-size: clamp(1.1rem, 2.4vw, 1.6rem);
        font-weight: 400;
        color: var(--text-secondary);
        margin-bottom: 0.4rem;
      }
      .manifesto__punch {
        font-size: clamp(3.5rem, 12vw, 8rem);
        font-weight: 800;
        letter-spacing: -0.04em;
        line-height: 0.95;
        color: var(--text-primary);
        margin: 0.2rem 0 1.2rem;
      }

      /* "Cute" types itself in (ngAfterViewInit); the cursor blinks like a prompt,
         then commits into a solid accent full-stop. A coder's period — returns 0. */
      .manifesto__type { white-space: pre; }
      .manifesto__dot {
        display: inline-block;
        width: 0.07em;
        height: 0.62em;
        border-radius: 0.035em;
        background: var(--color-primary);
        vertical-align: baseline;
        margin-left: 0.04em;
        transition: width 0.25s ease, height 0.25s ease, border-radius 0.25s ease,
                    margin-left 0.25s ease;
        animation: caretBlink 1s step-end infinite;
      }
      .manifesto__dot--period {
        width: 0.14em;
        height: 0.14em;
        border-radius: 50%;
        margin-left: 0.12em;
        animation: none;
      }
      @keyframes caretBlink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      .manifesto__reframe {
        font-size: clamp(1.5rem, 4vw, 2.6rem);
        font-weight: 600;
        line-height: 1.12;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin-bottom: 1.6rem;
      }
      .manifesto__reframe-line { display: block; text-wrap: balance; }
      /* The three reframe lines cascade one after another (mirrors the proof lines), so
         "20 000 linii — to dopiero rozgrzewka." / "Jeden plik." / "Jeden człowiek." step in
         on their own beats instead of popping as a block. */
      .manifesto.is-seq .manifesto__reframe-line {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(5px);
        /* Hidden via clip-path, not opacity alone: at rest these spans compute to opacity:1
           despite the rule above (a JS/animation effect overrides it), so clipping to zero
           width is what actually keeps them dark until their beat — same trick as proof-line. */
        clip-path: inset(-35% 100% -35% 0);
        transition:
          opacity 0.7s ease,
          transform 0.8s cubic-bezier(0.22, 1, 0.36, 1),
          filter 0.7s ease,
          clip-path 0.85s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .manifesto.is-seq .manifesto__reframe.is-in .manifesto__reframe-line {
        opacity: 1;
        transform: none;
        filter: blur(0);
        clip-path: inset(-35% 0 -35% 0);
      }
      .manifesto.is-seq .manifesto__reframe.is-in .manifesto__reframe-line:nth-child(2) { transition-delay: 0.34s; }
      .manifesto.is-seq .manifesto__reframe.is-in .manifesto__reframe-line:nth-child(3) { transition-delay: 0.68s; }
      @media (prefers-reduced-motion: reduce) {
        .manifesto.is-seq .manifesto__reframe-line {
          opacity: 1; transform: none; filter: none; transition: none;
        }
      }
      .manifesto__num {
        color: var(--color-primary);
        text-shadow: 0 0 28px rgba(56, 189, 248, 0.45);
        white-space: nowrap;
      }
      .manifesto__proof {
        position: relative;
        font-size: clamp(1rem, 2vw, 1.2rem);
        font-style: italic;
        color: var(--text-secondary);
        padding-left: 1.15rem;
        margin-bottom: 0.7rem;
        max-width: 40rem;
      }
      /* the door — a vertical bar the sentences step out of */
      .manifesto__proof::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0.06em;
        bottom: 0.06em;
        width: 2px;
        background: var(--color-primary);
        transform-origin: top center;
      }
      .manifesto__proof-line {
        display: block;
      }
      .manifesto__proof-line + .manifesto__proof-line {
        margin-top: 0.18rem;
      }
      /* Sequence: the bar opens like a door (grows top→bottom), then each sentence
         emerges from it — blurred→sharp, wiped from the bar rightwards, stepping out. */
      .manifesto.is-seq .manifesto__proof::before {
        transform: scaleY(0);
        opacity: 0;
        transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
      }
      .manifesto.is-seq .manifesto__proof.is-in::before {
        transform: scaleY(1);
        opacity: 1;
      }
      .manifesto.is-seq .manifesto__proof-line {
        opacity: 0;
        transform: translateX(-9px);
        filter: blur(5px);
        clip-path: inset(-30% 100% -30% 0);
        transition:
          opacity 0.7s ease,
          transform 0.85s cubic-bezier(0.22, 1, 0.36, 1),
          filter 0.7s ease,
          clip-path 0.85s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .manifesto.is-seq .manifesto__proof.is-in .manifesto__proof-line {
        opacity: 1;
        transform: none;
        filter: blur(0);
        clip-path: inset(-30% 0 -30% 0);
      }
      /* the ghosts step out one after another, just after the door has opened */
      .manifesto.is-seq .manifesto__proof.is-in .manifesto__proof-line:nth-child(1) { transition-delay: 0.30s; }
      .manifesto.is-seq .manifesto__proof.is-in .manifesto__proof-line:nth-child(2) { transition-delay: 0.62s; }
      .manifesto.is-seq .manifesto__proof.is-in .manifesto__proof-line:nth-child(3) { transition-delay: 0.94s; }
      @media (prefers-reduced-motion: reduce) {
        .manifesto.is-seq .manifesto__proof::before { transform: scaleY(1); opacity: 1; transition: none; }
        .manifesto.is-seq .manifesto__proof-line {
          opacity: 1; transform: none; filter: none; clip-path: none; transition: none;
        }
      }
      .manifesto__rest {
        font-size: clamp(1rem, 2vw, 1.25rem);
        font-style: italic;
        font-weight: 600;
        color: var(--color-primary-light);
        margin: 1.4rem 0 2.4rem;
      }

      /* The coda — proof2 on the left, the "Wejdź ↓" button lifted up to its right
         (instead of sitting alone at the bottom). Stacks under the lines on narrow screens. */
      .manifesto__coda {
        display: flex;
        align-items: flex-start; /* the button starts level with "Potem utrzymują…", not above it */
        justify-content: space-between;
        gap: 1rem 1.75rem;
        flex-wrap: nowrap; /* keep "Wejdź ↓" to the RIGHT of the two lines, never wrapped below */
      }
      .manifesto__coda .manifesto__proof { margin-bottom: 0; flex: 1 1 auto; min-width: 0; }
      .manifesto__coda .manifesto__enter { white-space: nowrap; }
      /* "Wejdź ↓" with "Pełne CV (…)" stacked right beneath it. */
      .manifesto__act {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.7rem;
        text-align: center;
      }

      .manifesto__cta {
        display: flex;
        align-items: center;
        gap: 2rem;
        flex-wrap: wrap;
      }
      .manifesto__enter {
        appearance: none;
        background: transparent;
        border: 1px solid var(--border-color-dark);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 1rem;
        letter-spacing: 0.04em;
        padding: 0.85rem 1.8rem;
        border-radius: var(--radius-full);
        cursor: pointer;
        transition: border-color var(--transition-base) ease,
                    background-color var(--transition-base) ease,
                    transform var(--transition-base) ease;
      }
      .manifesto__enter:hover {
        border-color: var(--color-primary);
        background: rgba(56, 189, 248, 0.08);
      }
      .manifesto__arrow {
        display: inline-block;
        margin-left: 0.4rem;
        animation: nudge 2.4s ease-in-out infinite;
      }
      @keyframes nudge {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(4px); }
      }
      .manifesto__cv {
        color: var(--text-secondary);
        font-size: 0.95rem;
        text-decoration: none;
        transition: color var(--transition-base) ease;
      }
      .manifesto__cv:hover { color: var(--text-primary); }
      .manifesto__cv-note { color: var(--text-tertiary); }

      /* The footer row — social on the left, the bell on the right, in flow. */
      .manifesto__footer {
        align-self: end;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
      }
      .manifesto__social {
        display: flex;
        gap: 1.4rem;
        z-index: 2;
      }
      .manifesto__social a {
        color: var(--text-tertiary);
        font-size: 1.15rem;
        transition: color var(--transition-base) ease, transform var(--transition-base) ease;
      }
      .manifesto__social a:hover {
        color: var(--color-primary);
        transform: translateY(-2px);
      }

      /* The bell — Łukasz's own composition, opt-in, off by default. */
      .manifesto__music {
        z-index: 2;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 8px 16px 8px 13px;
        background: rgba(56, 189, 248, 0.04);
        border: 1px solid rgba(56, 189, 248, 0.18);
        border-radius: var(--radius-full);
        color: var(--text-tertiary);
        font-family: inherit;
        font-size: 0.62rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 0.3s ease, border-color 0.3s ease,
                    background-color 0.3s ease, box-shadow 0.3s ease;
      }
      .manifesto__music:hover {
        color: var(--color-primary);
        border-color: rgba(56, 189, 248, 0.5);
        background: rgba(56, 189, 248, 0.08);
      }
      .manifesto__music.is-playing {
        color: var(--color-primary);
        border-color: rgba(56, 189, 248, 0.6);
        box-shadow: 0 0 22px rgba(56, 189, 248, 0.25);
      }
      .manifesto__music-text {
        display: inline-flex;
        flex-direction: column;
        gap: 1px;
        text-align: left;
        line-height: 1.2;
      }
      .manifesto__music-credit {
        text-transform: none;
        letter-spacing: 0.015em;
        font-size: 0.92em;
        font-weight: 500;
        opacity: 0.6;
      }
      .manifesto__eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 11px; }
      .manifesto__eq i { width: 2px; height: 3px; background: currentColor; border-radius: 1px; }
      .manifesto__music.is-playing .manifesto__eq i { animation: eqBar 0.9s ease-in-out infinite; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(2) { animation-duration: 0.7s; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(3) { animation-duration: 1.15s; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(4) { animation-duration: 0.82s; }
      @keyframes eqBar { 0%, 100% { height: 3px; } 50% { height: 11px; } }

      /* Short viewports (laptops / windowed desktop): the manifesto is tall, so scale
         the big type and the rhythm down with the viewport HEIGHT — this keeps the CTA
         and the footer badge above the fold instead of pushing them off-screen. */
      @media (max-height: 880px) {
        .manifesto { gap: clamp(0.75rem, 2vh, 1.5rem); padding-block: clamp(1.1rem, 3vh, 2rem); }
        .manifesto__lead { font-size: clamp(1rem, 2vh, 1.35rem); margin-bottom: 0.25rem; }
        .manifesto__punch { font-size: clamp(2.6rem, 11vh, 5rem); margin: 0.1rem 0 0.6rem; }
        .manifesto__reframe { font-size: clamp(1.3rem, 5vh, 2.1rem); margin-bottom: 0.85rem; }
        .manifesto__proof { margin-bottom: 0.4rem; }
        .manifesto__rest { font-size: clamp(0.95rem, 2vh, 1.15rem); margin: 0.75rem 0 1rem; }
      }
      @media (max-height: 720px) {
        .manifesto__stamp { font-size: 0.7rem; }
        .manifesto__punch { font-size: clamp(2.2rem, 9vh, 3.6rem); }
        .manifesto__reframe { font-size: clamp(1.15rem, 4.5vh, 1.6rem); }
        .manifesto__proof { font-size: 0.92rem; margin-bottom: 0.3rem; }
        .manifesto__rest { margin: 0.5rem 0 0.8rem; }
      }

      @media (max-width: 640px) {
        .manifesto__stamp { font-size: 0.68rem; }
        /* Pin the block under the stamp instead of centring it in the tall middle row. */
        .manifesto__inner { align-self: start; }
        /* Keep "Wejdź ↓" + CV beside the two lines, but cap their column so the proof text
           isn't shredded into one-word lines. */
        .manifesto__coda { gap: 0.75rem 1rem; }
        .manifesto__act { max-width: 8.5rem; }
        .manifesto__act .manifesto__cv { font-size: 0.78rem; }
        /* Stack the footer so the bell isn't squeezed against the icons. */
        .manifesto__footer {
          flex-direction: column;
          align-items: flex-start;
          gap: 1.5rem;
        }
      }
    `,
  ],
})
export class HeroSectionComponent implements AfterViewInit, OnDestroy {
  private scrollService = inject(ScrollService);
  private languageService = inject(LanguageService);
  protected readonly contact = CONTACT_CONFIG;

  protected readonly m = computed(
    () => MANIFESTO[this.languageService.currentLanguage()] ?? MANIFESTO['en'],
  );

  // Guided, reading-paced reveal. `step` gates each line into view one beat at a time;
  // `animate` is false for no-JS / SSR / reduced motion (whole manifesto shown at once).
  protected readonly step = signal(0);
  protected readonly animate = signal(false);
  protected readonly typed = signal('');
  protected readonly typedDone = signal(false);
  private firstTypeAfterStart = true;

  // Reveal cadence in BEATS from the gate lift, so the guided read locks to the score's tempo
  // (beatMs is refined from the score on load). Each line settles on its own beat.
  private readonly REVEAL_BEATS = {
    stamp: 0.5, lead: 2.5, punch: 5, reframe: 7.5,
    proof1: 10, proof2: 13, rest: 15.5, cta: 17.5,
  };
  private beatsToMs(beats: number): number {
    return Math.round(beats * this.beatMs);
  }
  private static readonly MAX_STEP = 8;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private punchTimer?: ReturnType<typeof setTimeout>;
  private skip?: () => void;
  private removeKick?: () => void;
  private bus?: { claim: () => void; close: () => void };
  private musicSaveTimer?: ReturnType<typeof setInterval>;

  constructor() {
    const hasWin = typeof window !== 'undefined';
    const reduce =
      hasWin && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // The punch types itself in — on load when its line appears, and on every language change.
    effect((onCleanup) => {
      const word = this.m().punch as string;
      if (!hasWin || reduce) {
        this.typed.set(word);
        this.typedDone.set(true);
        return;
      }
      const delay = this.firstTypeAfterStart ? this.beatsToMs(this.REVEAL_BEATS.punch) : 250;
      this.firstTypeAfterStart = false;
      onCleanup(this.typeWord(word, delay));
    });

    if (!hasWin || reduce) {
      // No guided sequence: show the whole manifesto immediately (also covers SSR / no-JS).
      this.animate.set(false);
      this.step.set(HeroSectionComponent.MAX_STEP);
      this.typed.set(this.m().punch as string);
      this.typedDone.set(true);
    } else {
      // Hidden initial state before first paint; then the guided sequence walks the beats.
      this.animate.set(true);
      this.step.set(0);
      this.startReveal();
    }
  }

  /** Type `word` one glyph at a time after `delay` ms; returns a cleanup fn. */
  private typeWord(word: string, delay: number): () => void {
    clearTimeout(this.punchTimer);
    this.typed.set('');
    this.typedDone.set(false);
    let i = 1;
    const tick = () => {
      this.typed.set(word.slice(0, i));
      if (i < word.length) {
        i++;
        this.punchTimer = setTimeout(tick, 120);
      } else {
        this.typedDone.set(true);
      }
    };
    this.punchTimer = setTimeout(tick, delay);
    return () => clearTimeout(this.punchTimer);
  }

  /** Reveal one line per beat, in reading order — called when the gate lifts. */
  private startReveal(): void {
    const at = (beats: number, s: number) =>
      this.timers.push(setTimeout(() => this.step.set(s), this.beatsToMs(beats)));
    const B = this.REVEAL_BEATS;
    at(B.stamp, 1); at(B.lead, 2); at(B.punch, 3); at(B.reframe, 4);
    at(B.proof1, 5); at(B.proof2, 6); at(B.rest, 7); at(B.cta, 8);
  }

  /** Fill the manifesto in now — when the reader scrolls/taps/keys before it finishes. */
  private revealAll(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    clearTimeout(this.punchTimer);
    this.step.set(HeroSectionComponent.MAX_STEP);
    this.typed.set(this.m().punch as string);
    this.typedDone.set(true);
  }

  protected readonly musicOn = signal(false);
  protected notes: number[][] | null = null;
  protected beatMs = 582.5; // quarter-note length; refined from the score's bpm on load
  protected readonly leadInSec = 6; // count-in length — notes roll in from the right edge of the staff
  protected player: SwiatloPlayer | null = null;

  /** The manifesto's punch types itself in, then the cursor commits to a period. */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    // If another tab (the full CV) takes over the bell, yield it here so they never double.
    this.bus = swiatloBus(() => {
      if (this.player?.isPlaying()) this.player.toggle();
    });

    // Let an impatient reader fast-forward the guided read by scrolling.
    if (this.animate()) this.attachSkip();

    // Load Łukasz's composition for opt-in playback (the bell — never autoplays).
    fetch('swiatlo.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.notes) { this.notes = d.notes; if (d.bpm) this.beatMs = 60000 / d.bpm; } })
      .catch(() => {});

    // The bell is too small to aim at — start on the first interaction anywhere. Hardened for
    // iOS: a tap fires several events (pointerup/touchend/click) — dedupe them; KEEP listening
    // and retry until audio is *actually* playing (iOS often needs a 2nd gesture, and the first
    // tap may land before the score has loaded); and never toggle OFF from here.
    let starting = false;
    const evs = ['pointerup', 'touchend', 'click', 'keydown'];
    const kick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.manifesto__music')) return; // the bell handles itself
      if (this.player && this.player.isPlaying()) { this.removeKick?.(); return; }
      if (!this.notes || starting) return; // score not loaded yet → a later gesture retries
      starting = true;
      setTimeout(() => (starting = false), 500); // iOS may not unlock on the 1st gesture — allow a retry
      this.toggleMusic(); // creates + resumes the AudioContext INSIDE this gesture (the iOS unlock)
    };
    this.removeKick = () => evs.forEach((ev) => document.removeEventListener(ev, kick));
    evs.forEach((ev) => document.addEventListener(ev, kick, { passive: true }));
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
    clearTimeout(this.punchTimer);
    this.removeSkip();
    this.removeKick?.();
    this.stopMusicSave();
    this.bus?.close();
    this.player?.dispose(); // stop & release audio so navigating away+back doesn't double it
    this.player = null;
  }

  private startMusicSave(): void {
    this.stopMusicSave();
    this.musicSaveTimer = setInterval(() => {
      if (this.player) saveHandoff(this.player.position(), true);
    }, 700);
  }
  private stopMusicSave(): void {
    if (this.musicSaveTimer) {
      clearInterval(this.musicSaveTimer);
      this.musicSaveTimer = undefined;
    }
  }

  /** After the gate lifts, let an impatient reader fast-forward the guided read by scrolling. */
  private attachSkip(): void {
    if (this.skip) return;
    const skip = () => {
      this.revealAll();
      this.removeSkip();
    };
    this.skip = skip;
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchmove', skip, { passive: true });
  }

  private removeSkip(): void {
    const skip = this.skip;
    if (!skip) return;
    window.removeEventListener('wheel', skip);
    window.removeEventListener('touchmove', skip);
    this.skip = undefined;
  }

  enter(): void {
    this.scrollService.scrollToSection('projects');
  }

  /** The bell — opt-in. The click is the gesture browsers need to start audio. */
  toggleMusic(): void {
    if (!this.notes) return;
    if (!this.player) {
      this.player = createSwiatlo(this.notes, {
        onState: (on) => {
          this.musicOn.set(on);
          if (on) {
            this.removeKick?.(); // truly playing now — stop the global tap-to-start
            this.bus?.claim(); // ask other tabs (e.g. the CV tab) to yield the bell
            this.startMusicSave(); // keep persisting the position for a possible handoff
          } else {
            this.stopMusicSave();
            saveHandoff(this.player ? this.player.position() : 0, false);
          }
        },
        leadInSec: this.leadInSec, // loop restarts roll the score in from the right edge
      });
    }
    this.player.toggle();
  }

  /** Doubled so the vertical drift loops seamlessly. */
  protected get codeLoop(): string {
    return this.code + '\n' + this.code;
  }

  // Real-looking on-prem document-AI pipeline — texture, not content. Near-invisible.
  protected readonly code = `import torch
from transformers import AutoProcessor, AutoModelForVision2Seq
from pydantic import BaseModel, Field
from pathlib import Path

class LineItem(BaseModel):
    label: str
    value: float = Field(..., description="amount in PLN")

class Statement(BaseModel):
    period: str
    currency: str = "PLN"
    items: list[LineItem]

class OnPremExtractor:
    """Local vision + language. No document ever leaves the network."""

    def __init__(self, weights: Path, device: str = "cuda"):
        self.device = device
        self.processor = AutoProcessor.from_pretrained(weights)
        self.model = AutoModelForVision2Seq.from_pretrained(
            weights, torch_dtype=torch.bfloat16
        ).to(device).eval()

    @torch.inference_mode()
    def layout(self, page):
        inputs = self.processor(images=page, return_tensors="pt").to(self.device)
        out = self.model.generate(**inputs, max_new_tokens=1024)
        return self.processor.batch_decode(out, skip_special_tokens=True)[0]

    def extract(self, scan) -> Statement:
        blocks = [self.layout(p) for p in self.paginate(scan)]
        schema = self.to_schema(blocks)
        return Statement.model_validate(schema)  # structured outputs, validated

    def paginate(self, scan):
        for page in scan:
            yield self.deskew(self.binarize(page))
`;
}
