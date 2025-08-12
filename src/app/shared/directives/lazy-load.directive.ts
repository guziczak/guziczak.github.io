import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true,
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  @Input() appLazyLoad = ''; // The image URL to lazy load
  @Input() placeholder =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f0f0f0"/%3E%3C/svg%3E';

  private observer: IntersectionObserver | null = null;
  
  private readonly CONFIG = {
    ROOT_MARGIN: '50px 0px',
    THRESHOLD: 0.01,
    FADE_DURATION: '0.5s',
    BLUR_INITIAL: '10px',
    BLUR_LOADED: '0',
    SCALE_INITIAL: 0.95,
    SCALE_LOADED: 1
  };

  constructor(private el: ElementRef<HTMLImageElement | HTMLElement>) {}

  ngOnInit() {
    // Set placeholder immediately
    if (this.el.nativeElement instanceof HTMLImageElement) {
      this.el.nativeElement.src = this.placeholder;
      this.el.nativeElement.classList.add('lazy-loading');
    }

    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      this.createObserver();
    } else {
      // Fallback: load image immediately
      this.loadImage();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private createObserver() {
    const options = {
      rootMargin: this.CONFIG.ROOT_MARGIN, // Start loading 50px before entering viewport
      threshold: this.CONFIG.THRESHOLD,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage();
          if (this.observer) {
            this.observer.unobserve(this.el.nativeElement);
          }
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private loadImage() {
    const element = this.el.nativeElement;

    // Create a new image to preload
    const img = new Image();

    img.onload = () => {
      // Apply the image
      if (element instanceof HTMLImageElement) {
        element.src = this.appLazyLoad;
      } else {
        element.style.backgroundImage = `url(${this.appLazyLoad})`;
      }

      // Add loaded class and remove loading class
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-loaded');

      // Trigger fade-in animation
      this.animateFadeIn(element);
    };

    img.onerror = () => {
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-error');

      if (element instanceof HTMLImageElement) {
        element.alt = element.alt || 'Image failed to load';
      }
    };

    // Start loading
    img.src = this.appLazyLoad;
  }

  private animateFadeIn(element: HTMLElement) {
    element.style.animation = `lazyFadeIn ${this.CONFIG.FADE_DURATION} ease-in-out`;

    // Remove animation after completion
    element.addEventListener(
      'animationend',
      () => {
        element.style.animation = '';
      },
      { once: true },
    );
  }
}

// Export for use in components
export function provideLazyLoadStyles(): string {
  const config = {
    BLUR_INITIAL: '10px',
    BLUR_LOADED: '0',
    TRANSITION_DURATION: '0.5s',
    ERROR_OPACITY: 0.5,
    SCALE_INITIAL: 0.95,
    SCALE_LOADED: 1
  };
  
  return `
    .lazy-loading {
      filter: blur(${config.BLUR_INITIAL});
      transition: filter ${config.TRANSITION_DURATION} ease-in-out;
    }
    
    .lazy-loaded {
      filter: blur(${config.BLUR_LOADED});
    }
    
    .lazy-error {
      filter: blur(${config.BLUR_LOADED});
      opacity: ${config.ERROR_OPACITY};
    }
    
    @keyframes lazyFadeIn {
      from {
        opacity: 0;
        transform: scale(${config.SCALE_INITIAL});
      }
      to {
        opacity: 1;
        transform: scale(${config.SCALE_LOADED});
      }
    }
  `;
}
