import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationService } from '../../core/services/animation.service';
import { HeroSectionComponent } from '../../features/home/hero-section.component';
import { ProjectsSectionComponent } from '../../features/projects/projects-section.component';
import { IpIntegritySectionComponent } from '../../features/ip-integrity/ip-integrity-section.component';
import { NumbersSectionComponent } from '../../features/numbers/numbers-section.component';
import { ContactSectionComponent } from '../../features/contact/contact-section.component';
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';

/**
 * The cathedral — one descent: manifesto → proof → numbers → delivery integrity → quiet exit.
 * The performer sections (about, skills, games, certificates, achievements,
 * testimonials) are gone. Mniej rzeczy, każda cięższa.
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    ProjectsSectionComponent,
    IpIntegritySectionComponent,
    NumbersSectionComponent,
    ContactSectionComponent,
    ScrollProgressComponent,
    BackToTopComponent,
  ],
  template: `
    <app-scroll-progress />

    <!-- Breathing code behind the whole descent — drifts forever, near-invisible. -->
    <div class="code-backdrop" aria-hidden="true">
      <pre>{{ codeLoop }}</pre>
    </div>

    <main class="main-content">
      <app-hero-section id="home" />
      <app-projects-section id="projects" />
      <app-numbers-section id="numbers" />
      <app-ip-integrity-section />
      <app-contact-section id="contact" />
    </main>

    <app-back-to-top />
  `,
  styles: [
    `
      /* Faint drifting code behind the page — shows through the transparent
         sections (proof, exit); the hero keeps its own denser field and numbers
         stays a solid band. Sits below content via z-index. */
      .code-backdrop {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
        opacity: 0.05;
        -webkit-mask-image: linear-gradient(
          180deg,
          transparent,
          #000 12%,
          #000 88%,
          transparent
        );
        mask-image: linear-gradient(
          180deg,
          transparent,
          #000 12%,
          #000 88%,
          transparent
        );
      }
      .code-backdrop pre {
        margin: 0;
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.55;
        color: var(--color-primary-light);
        white-space: pre;
        animation: backdrop-drift 120s linear infinite;
      }
      @keyframes backdrop-drift {
        from {
          transform: translateY(0);
        }
        to {
          transform: translateY(-50%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .code-backdrop pre {
          animation: none;
        }
      }

      .main-content {
        position: relative;
        z-index: 1;
        width: 100%;
        overflow-x: hidden;
      }
    `,
  ],
})
export class HomePageComponent implements OnInit {
  private animationService = inject(AnimationService);

  ngOnInit() {
    // Reveal .animate-on-scroll elements once the view is ready.
    setTimeout(() => {
      this.animationService.reinitializeAnimations();
    }, 500);
  }

  /** Doubled so the vertical drift loops seamlessly. */
  protected get codeLoop(): string {
    return this.code + '\n' + this.code;
  }

  // Texture, not content — a local dense-retrieval pipeline, near-invisible behind the page.
  protected readonly code = `from __future__ import annotations
import torch
import torch.nn.functional as F
from dataclasses import dataclass


@dataclass
class Doc:
    page: int
    tokens: list[int]
    bbox: tuple[float, float, float, float]


class Retriever:
    """Local dense retrieval — the index never leaves the box."""

    def __init__(self, dim: int = 768):
        self.dim = dim
        self.index = torch.empty(0, dim)

    @torch.inference_mode()
    def add(self, vecs: torch.Tensor) -> None:
        self.index = torch.cat([self.index, F.normalize(vecs, dim=-1)])

    @torch.inference_mode()
    def search(self, q: torch.Tensor, k: int = 8):
        sims = F.normalize(q, dim=-1) @ self.index.T
        return sims.topk(min(k, self.index.shape[0]), dim=-1)


def rerank(pairs, model):
    scores = model(pairs).sigmoid()
    return sorted(zip(pairs, scores), key=lambda x: -x[1])
`;
}
