import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AnimationService {
  constructor() {
    if (typeof window !== 'undefined') {
      this.initScrollAnimations();
    }
  }

  private initScrollAnimations(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      },
    );

    // Observe all elements with animate-on-scroll class
    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observer.observe(el);
    });
  }

  // Re-initialize animations (useful after content changes)
  reinitializeAnimations(): void {
    setTimeout(() => {
      this.initScrollAnimations();
    }, 100);
  }
}
