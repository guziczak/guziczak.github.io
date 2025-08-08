import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollService } from '../../../core/services/scroll.service';

@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scroll-progress" [style.width.%]="scrollPercentage()"></div>
  `,
  styles: [
    `
      .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: linear-gradient(
          to right,
          var(--color-primary),
          var(--color-secondary)
        );
        z-index: 2000;
        transition: width 0.1s ease;
      }
    `,
  ],
})
export class ScrollProgressComponent {
  private scrollService = inject(ScrollService);

  scrollPercentage = computed(() => {
    const scrollPos = this.scrollService.currentScrollPosition();
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    return docHeight > 0 ? (scrollPos / docHeight) * 100 : 0;
  });
}
