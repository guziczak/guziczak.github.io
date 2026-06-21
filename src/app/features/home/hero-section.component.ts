import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';
import { CONTACT_CONFIG } from '../../core/config/contact.config';

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
        <p class="manifesto__punch" style="--i: 1">Cute.</p>
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

      @media (max-width: 640px) {
        .manifesto__stamp { font-size: 0.68rem; }
        .manifesto__social { position: static; margin-top: 2.5rem; }
      }
    `,
  ],
})
export class HeroSectionComponent {
  private scrollService = inject(ScrollService);
  protected readonly contact = CONTACT_CONFIG;

  enter(): void {
    this.scrollService.scrollToSection('projects');
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
