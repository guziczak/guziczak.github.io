import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';
import { CONTACT_CONFIG } from '../../core/config/contact.config';
import { createSwiatlo, SwiatloPlayer } from './swiatlo-player';

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
    <section class="manifesto" id="home">
      <!-- Signature: a whisper of real code, drifting, near-invisible -->
      <div class="manifesto__code" aria-hidden="true">
        <pre>{{ codeLoop }}</pre>
      </div>

      <div class="manifesto__stamp">
        <span class="manifesto__kicker">Łukasz Guziczak · AI Engineer</span>
        <span>In the lab since 2016. In production since 2024. Not since ChatGPT.</span>
        <span>Currently embedded at a bank — on-prem, regulated.</span>
      </div>

      <div class="manifesto__inner">
        <p class="manifesto__lead" style="--i: 0">
          They say AI loses the thread past 1,000 lines of code.
        </p>
        <p class="manifesto__punch" style="--i: 1"><span class="manifesto__type">{{ typed() }}</span><span class="manifesto__dot" [class.manifesto__dot--period]="typedDone()" aria-hidden="true"></span></p>
        <p class="manifesto__reframe" style="--i: 2">
          That's where I start — <span class="manifesto__num">20,000</span> lines.
          One file. One person.
        </p>
        <p class="manifesto__proof" style="--i: 3">
          A month to a working PoC. Three to production. No team.
        </p>
        <p class="manifesto__proof" style="--i: 4">
          Their teams maintain it. I'm on the next.
        </p>
        <p class="manifesto__rest" style="--i: 5">The code says the rest.</p>

        <div class="manifesto__cta" style="--i: 6">
          <button (click)="enter()" class="manifesto__enter">
            Enter <span class="manifesto__arrow">↓</span>
          </button>
          <a href="/cv" target="_blank" rel="noopener noreferrer" class="manifesto__cv">
            The full CV <span class="manifesto__cv-note">(You won't need it.)</span>
          </a>
        </div>
      </div>

      <div class="manifesto__social" style="--i: 7">
        <a [href]="contact.github" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fab fa-github"></i></a>
        <a [href]="contact.linkedin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
        <a [href]="'mailto:' + contact.email" aria-label="Email"><i class="fas fa-envelope"></i></a>
      </div>

      <button class="manifesto__music" type="button"
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
        animation: engrave 0.9s var(--ease, cubic-bezier(0.33, 1, 0.68, 1)) both;
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
      .manifesto__inner > * {
        animation: engrave 0.85s cubic-bezier(0.33, 1, 0.68, 1) both;
        animation-delay: calc(0.18s + var(--i) * 0.12s);
      }

      @keyframes engrave {
        from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
        to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
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
        animation: engrave 0.85s cubic-bezier(0.33, 1, 0.68, 1) both;
        animation-delay: calc(0.18s + var(--i) * 0.12s);
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
        animation: engrave 0.85s cubic-bezier(0.33, 1, 0.68, 1) both;
        animation-delay: 1s;
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
        .manifesto__stamp { font-size: 0.68rem; }
        .manifesto__social { position: static; margin-top: 2.5rem; }
        .manifesto__music { position: static; align-self: flex-start; margin-top: 1.5rem; }
      }
    `,
  ],
})
export class HeroSectionComponent implements AfterViewInit {
  private scrollService = inject(ScrollService);
  protected readonly contact = CONTACT_CONFIG;

  protected readonly typed = signal('');
  protected readonly typedDone = signal(false);
  private readonly punchWord = 'Cute';

  protected readonly musicOn = signal(false);
  private notes: number[][] | null = null;
  private player: SwiatloPlayer | null = null;

  /** The manifesto's punch types itself in, then the cursor commits to a period. */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') {
      this.typed.set(this.punchWord);
      this.typedDone.set(true);
      return;
    }
    // Load Łukasz's composition for opt-in playback (the bell — never autoplays).
    fetch('swiatlo.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.notes) this.notes = d.notes; })
      .catch(() => {});
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.typed.set(this.punchWord);
      this.typedDone.set(true);
      return;
    }
    let i = 1;
    const tick = () => {
      this.typed.set(this.punchWord.slice(0, i));
      if (i < this.punchWord.length) {
        i++;
        setTimeout(tick, 120);
      } else {
        this.typedDone.set(true);
      }
    };
    setTimeout(tick, 1500);
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
