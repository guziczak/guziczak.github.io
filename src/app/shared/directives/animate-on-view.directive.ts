import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appAnimateOnView]',
  standalone: true,
})
export class AnimateOnViewDirective implements OnInit, OnDestroy {
  @Input() appAnimateOnView = 'animate';
  @Input() threshold = 0.2;
  @Input() animateOnce = true;

  private el = inject(ElementRef);
  private observer?: IntersectionObserver;
  private hasAnimated = false;
  
  private readonly CONFIG = {
    DEFAULT_THRESHOLD: 0.2,
    ROOT_MARGIN: '0px',
    PROGRESS_DELAY_MS: 200
  };

  ngOnInit() {
    if ('IntersectionObserver' in window) {
      this.createObserver();
    } else {
      // Fallback - show immediately
      this.animate();
    }
  }

  private createObserver() {
    const options = {
      threshold: this.threshold || this.CONFIG.DEFAULT_THRESHOLD,
      rootMargin: this.CONFIG.ROOT_MARGIN,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!this.hasAnimated || !this.animateOnce) {
            this.animate();
            this.hasAnimated = true;

            if (this.animateOnce) {
              this.observer?.disconnect();
            }
          }
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private animate() {
    const element = this.el.nativeElement;

    // Special handling for progress bars
    if (element.classList.contains('skill-progress')) {
      const level = element.getAttribute('data-level');
      if (level) {
        setTimeout(() => {
          element.style.width = `${level}%`;
        }, this.CONFIG.PROGRESS_DELAY_MS);
      }
    } else {
      // General animation
      element.classList.add(this.appAnimateOnView);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
