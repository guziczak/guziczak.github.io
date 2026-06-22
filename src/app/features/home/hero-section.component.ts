import { Component, inject, signal, computed, effect, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';
import { LanguageService } from '../../core/services/language.service';
import { CONTACT_CONFIG } from '../../core/config/contact.config';
import { createSwiatlo, SwiatloPlayer } from './swiatlo-player';

const MANIFESTO: Record<string, any> = {
  en: {
    stamp: ['In the lab since 2016. In production since 2024. Not since ChatGPT.', 'Currently embedded at a bank — on-prem, regulated.'],
    lead: 'They say AI loses the thread past 1,000 lines of code.',
    punch: 'Cute',
    reframeA: "That's where I start — ", reframeB: ' lines. One file. One person.',
    proof1: 'A month to a working PoC. Three to production. No team.',
    proof2: "Their teams maintain it. I'm on the next.",
    rest: 'The code says the rest.',
    enter: 'Enter', cvText: 'The full CV', cvNote: "(You won't need it.)",
  },
  pl: {
    stamp: ['W laboratorium od 2016. Na produkcji od 2024. Nie od ChatGPT.', 'Obecnie w banku — on-prem, regulowany.'],
    lead: 'Mówią, że AI gubi wątek po 1000 liniach kodu.',
    punch: 'Urocze',
    reframeA: 'Ja tam zaczynam — ', reframeB: ' linii. Jeden plik. Jeden człowiek.',
    proof1: 'Miesiąc do działającego PoC. Trzy do produkcji. Bez zespołu.',
    proof2: 'Ich zespoły to utrzymują. Ja jestem przy następnym.',
    rest: 'Resztę mówi kod.',
    enter: 'Wejdź', cvText: 'Pełne CV', cvNote: '(Nie będzie ci potrzebne.)',
  },
  de: {
    stamp: ['Im Labor seit 2016. In Produktion seit 2024. Nicht seit ChatGPT.', 'Derzeit in einer Bank — On-Prem, reguliert.'],
    lead: 'Sie sagen, KI verliert den Faden nach 1.000 Zeilen Code.',
    punch: 'Niedlich',
    reframeA: 'Da fange ich an — ', reframeB: ' Zeilen. Eine Datei. Eine Person.',
    proof1: 'Ein Monat bis zum funktionierenden PoC. Drei bis zur Produktion. Kein Team.',
    proof2: 'Ihre Teams pflegen es. Ich bin schon beim nächsten.',
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
  imports: [CommonModule, RouterModule],
  template: `
    <section class="manifesto" id="home" [class.is-seq]="animate()">
      <!-- Signature: a whisper of real code, drifting, near-invisible -->
      <div class="manifesto__code" aria-hidden="true">
        <pre>{{ codeLoop }}</pre>
      </div>

      <div class="manifesto__stamp reveal" [class.is-in]="step() >= 1">
        <span class="manifesto__kicker">Łukasz Guziczak · AI Engineer</span>
        <span>{{ m().stamp[0] }}</span>
        <span>{{ m().stamp[1] }}</span>
      </div>

      <div class="manifesto__inner">
        <p class="manifesto__lead reveal" [class.is-in]="step() >= 2">{{ m().lead }}</p>
        <p class="manifesto__punch reveal" [class.is-in]="step() >= 3"><span class="manifesto__type">{{ typed() }}</span><span class="manifesto__dot" [class.manifesto__dot--period]="typedDone()" aria-hidden="true"></span></p>
        <p class="manifesto__reframe reveal" [class.is-in]="step() >= 4">{{ m().reframeA }}<span class="manifesto__num">20,000</span>{{ m().reframeB }}</p>
        <p class="manifesto__proof reveal" [class.is-in]="step() >= 5">{{ m().proof1 }}</p>
        <p class="manifesto__proof reveal" [class.is-in]="step() >= 6">{{ m().proof2 }}</p>
        <p class="manifesto__rest reveal" [class.is-in]="step() >= 7">{{ m().rest }}</p>

        <div class="manifesto__cta reveal" [class.is-in]="step() >= 8">
          <button (click)="enter()" class="manifesto__enter">
            {{ m().enter }} <span class="manifesto__arrow">↓</span>
          </button>
          <a href="/cv" target="_blank" rel="noopener noreferrer" class="manifesto__cv">
            {{ m().cvText }} <span class="manifesto__cv-note">{{ m().cvNote }}</span>
          </a>
        </div>
      </div>

      <div class="manifesto__social reveal" [class.is-in]="step() >= 8">
        <a [href]="contact.github" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fab fa-github"></i></a>
        <a [href]="contact.linkedin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
        <a [href]="'mailto:' + contact.email" aria-label="Email"><i class="fas fa-envelope"></i></a>
      </div>

      <button class="manifesto__music reveal" type="button"
              [class.is-in]="step() >= 8"
              [class.is-playing]="musicOn()" (click)="toggleMusic()"
              [attr.aria-pressed]="musicOn()"
              aria-label="Play 'światło w ciemności' — my own composition, synthesised live">
        <span class="manifesto__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>światło w ciemności</span>
      </button>
    </section>
  `,
  styles: [
    `
      .manifesto {
        position: relative;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: clamp(2rem, 6vw, 6rem);
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
        position: absolute;
        top: clamp(2rem, 5vh, 3.5rem);
        left: clamp(2rem, 6vw, 6rem);
        right: clamp(2rem, 6vw, 6rem);
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

      .manifesto__inner {
        position: relative;
        z-index: 2;
        max-width: 56rem;
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
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin-bottom: 1.6rem;
      }
      .manifesto__num {
        color: var(--color-primary);
        text-shadow: 0 0 28px rgba(56, 189, 248, 0.45);
      }
      .manifesto__proof {
        font-size: clamp(1rem, 2vw, 1.2rem);
        font-style: italic;
        color: var(--text-secondary);
        padding-left: 1rem;
        border-left: 2px solid var(--color-primary);
        margin-bottom: 0.5rem;
        max-width: 40rem;
      }
      .manifesto__rest {
        font-size: clamp(1rem, 2vw, 1.25rem);
        font-style: italic;
        font-weight: 600;
        color: var(--color-primary-light);
        margin: 1.4rem 0 2.4rem;
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

      .manifesto__social {
        position: absolute;
        bottom: clamp(1.5rem, 4vw, 3rem);
        left: clamp(2rem, 6vw, 6rem);
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
        position: absolute;
        bottom: clamp(1.5rem, 4vw, 3rem);
        right: clamp(2rem, 6vw, 6rem);
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
      .manifesto__eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 11px; }
      .manifesto__eq i { width: 2px; height: 3px; background: currentColor; border-radius: 1px; }
      .manifesto__music.is-playing .manifesto__eq i { animation: eqBar 0.9s ease-in-out infinite; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(2) { animation-duration: 0.7s; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(3) { animation-duration: 1.15s; }
      .manifesto__music.is-playing .manifesto__eq i:nth-child(4) { animation-duration: 0.82s; }
      @keyframes eqBar { 0%, 100% { height: 3px; } 50% { height: 11px; } }

      @media (max-width: 640px) {
        .manifesto {
          justify-content: flex-start;
          padding-top: 3.5rem;
        }
        .manifesto__stamp {
          position: static;
          font-size: 0.68rem;
          margin-bottom: 2.25rem;
        }
        .manifesto__social { position: static; margin-top: 2.5rem; }
        .manifesto__music { position: static; align-self: flex-start; margin-top: 1.5rem; }
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

  // Absolute ms from load when each line settles in — tune freely, lower = brisker.
  // The punch starts typing exactly when its line appears (REVEAL_MS.punch).
  private readonly REVEAL_MS = {
    stamp: 250, lead: 1450, punch: 2950, reframe: 4350,
    proof1: 5850, proof2: 7200, rest: 8400, cta: 9500,
  };
  private static readonly MAX_STEP = 8;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private punchTimer?: ReturnType<typeof setTimeout>;
  private skip?: () => void;

  constructor() {
    const hasWin = typeof window !== 'undefined';
    const reduce =
      hasWin && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // The punch types itself in — on load when its line appears, and on every language change.
    let firstType = true;
    effect((onCleanup) => {
      const word = this.m().punch as string;
      if (!hasWin || reduce) {
        this.typed.set(word);
        this.typedDone.set(true);
        return;
      }
      const delay = firstType ? this.REVEAL_MS.punch : 250;
      firstType = false;
      onCleanup(this.typeWord(word, delay));
    });

    if (!hasWin || reduce) {
      // No guided sequence: show the whole manifesto immediately.
      this.animate.set(false);
      this.step.set(HeroSectionComponent.MAX_STEP);
      this.typed.set(this.m().punch as string);
      this.typedDone.set(true);
    } else {
      // Hidden initial state is set before first paint; then walk the beats.
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

  /** Reveal one line per beat, in reading order. */
  private startReveal(): void {
    const at = (ms: number, s: number) =>
      this.timers.push(setTimeout(() => this.step.set(s), ms));
    const R = this.REVEAL_MS;
    at(R.stamp, 1); at(R.lead, 2); at(R.punch, 3); at(R.reframe, 4);
    at(R.proof1, 5); at(R.proof2, 6); at(R.rest, 7); at(R.cta, 8);
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
  private notes: number[][] | null = null;
  private player: SwiatloPlayer | null = null;

  /** The manifesto's punch types itself in, then the cursor commits to a period. */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    // Let an impatient reader fast-forward the intro: first scroll / tap / key fills it in.
    if (this.animate()) {
      const skip = () => {
        this.revealAll();
        this.removeSkip();
      };
      this.skip = skip;
      window.addEventListener('pointerdown', skip, { passive: true });
      window.addEventListener('keydown', skip);
      window.addEventListener('wheel', skip, { passive: true });
      window.addEventListener('touchmove', skip, { passive: true });
    }

    // Load Łukasz's composition for opt-in playback (the bell — never autoplays).
    fetch('swiatlo.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.notes) this.notes = d.notes; })
      .catch(() => {});

    // The bell is too small to aim at — start on the first interaction anywhere.
    const kick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.manifesto__music')) return;
      if (!this.notes) return;
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('keydown', kick);
      if (!this.player) this.toggleMusic();
      else if (!this.player.isPlaying()) this.toggleMusic();
    };
    document.addEventListener('pointerdown', kick, { passive: true });
    document.addEventListener('keydown', kick);
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
    clearTimeout(this.punchTimer);
    this.removeSkip();
  }

  private removeSkip(): void {
    const skip = this.skip;
    if (!skip) return;
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
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
      this.player = createSwiatlo(this.notes, { onState: (on) => this.musicOn.set(on) });
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
