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
      }
    `,
  ],
})
export class BackToTopComponent {
  private scrollService = inject(ScrollService);

  isVisible = computed(() => this.scrollService.currentScrollPosition() > 500);

  scrollToTop(): void {
    this.scrollService.scrollToTop();
  }
}
