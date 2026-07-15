import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollService } from '../../../core/services/scroll.service';

@Component({
  selector: 'app-back-to-top',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="back-to-top"
      [class.visible]="isVisible()"
      (click)="scrollToTop()"
      aria-label="Back to top"
    >
      <i class="fas fa-arrow-up"></i>
    </button>
  `,
  styles: [
    `
      .back-to-top {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: var(--color-primary);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px);
        transition: all 0.3s ease;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 112, 243, 0.3);

        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0, 112, 243, 0.4);
        }

        &.visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          bottom: 1rem;
          right: 1rem;
          width: 45px;
          height: 45px;
        }

        /* A fixed circle inevitably covers the full-width evidence ledgers on phones.
           Mobile browsers already expose a native jump-to-top gesture, so preserve the
           content and keep this desktop convenience out of the narrow reading column. */
        @media (max-width: 640px) {
          display: none;
        }
      }
    `,
  ],
})
export class BackToTopComponent {
  private scrollService = inject(ScrollService);

  // Shown once the reader is past the first fold — but NOT at the very bottom.
  // The quiet exit ends in the footer (which already holds the way back up), and
  // down there the floating button would sit right on top of the © line.
  isVisible = computed(() => {
    const y = this.scrollService.currentScrollPosition();
    if (y <= 500) return false;
    if (typeof window === 'undefined' || typeof document === 'undefined')
      return true;
    const remaining =
      document.documentElement.scrollHeight - (y + window.innerHeight);
    return remaining > 160;
  });

  scrollToTop(): void {
    this.scrollService.scrollToTop();
  }
}
