import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  private observers: IntersectionObserver[] = [];
  private reinitializeTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initScrollAnimations();
    }
  }

  private initScrollAnimations(): void {
    this.disconnectObservers();

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('.animate-on-scroll'),
    );
    if (!elements.length) return;

    // Reduced-motion readers should not wait for a scroll gate that only exists to animate.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => el.classList.add('active'));
      return;
    }

    const observer = this.createObserver(
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      },
      0.1,
    );
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const mobileExhibitObserver = isMobile
      ? this.createObserver(
          {
            // A tall, stacked exhibit should be meaningfully in view before its internal
            // sequence starts; 25% is deliberately later than the generic 10% reveal.
            threshold: 0.25,
            rootMargin: '0px 0px -8% 0px',
          },
          0.25,
        )
      : null;

    // Observe all elements with animate-on-scroll class
    elements.forEach((el) => {
      if (el.classList.contains('active')) return;
      const isTallMobileExhibit =
        mobileExhibitObserver !== null &&
        el.classList.contains('exhibit') &&
        el.getBoundingClientRect().height > window.innerHeight * 0.75;
      (isTallMobileExhibit ? mobileExhibitObserver : observer).observe(el);
    });
  }

  private createObserver(
    options: IntersectionObserverInit,
    minimumIntersectionRatio: number,
  ): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // Observers emit an initial entry even when an element is only barely visible,
        // so enforce the intended threshold explicitly before committing the reveal.
        if (
          !entry.isIntersecting ||
          entry.intersectionRatio < minimumIntersectionRatio
        ) {
          return;
        }
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      });
    }, options);
    this.observers.push(observer);
    return observer;
  }

  private disconnectObservers(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }

  // Re-initialize animations (useful after content changes)
  reinitializeAnimations(): void {
    this.disconnectObservers();
    if (this.reinitializeTimer !== null) {
      window.clearTimeout(this.reinitializeTimer);
    }
    this.reinitializeTimer = window.setTimeout(() => {
      this.reinitializeTimer = null;
      this.initScrollAnimations();
    }, 100);
  }
}
