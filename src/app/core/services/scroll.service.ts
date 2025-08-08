import { Injectable, signal, effect } from '@angular/core';
import { fromEvent, throttleTime } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScrollService {
  // Signals for reactive scroll state
  private scrollPosition = signal(0);
  private activeSection = signal('home');

  // Public readonly signals
  public currentScrollPosition = this.scrollPosition.asReadonly();
  public currentSection = this.activeSection.asReadonly();

  // Sections configuration
  private sections = [
    'home',
    'about',
    'skills',
    'projects',
    'achievements',
    'games',
    'testimonials',
    'contact',
  ];

  constructor() {
    // Listen to scroll events
    if (typeof window !== 'undefined') {
      fromEvent(window, 'scroll')
        .pipe(throttleTime(100))
        .subscribe(() => {
          this.updateScrollPosition();
          this.updateActiveSection();
        });
    }
  }

  private updateScrollPosition(): void {
    this.scrollPosition.set(window.scrollY);
  }

  private updateActiveSection(): void {
    const scrollPos = window.scrollY;
    const windowHeight = window.innerHeight;
    const offset = 200; // Offset for navbar and better detection

    // Check each section
    for (const section of this.sections) {
      const element = document.getElementById(section);
      if (element) {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollPos;
        const elementBottom = elementTop + element.offsetHeight;

        // Check if section is in viewport
        if (scrollPos + offset >= elementTop && scrollPos < elementBottom) {
          this.activeSection.set(section);
          break;
        }
      }
    }

    // Special case for top of page
    if (scrollPos < 100) {
      this.activeSection.set('home');
    }
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const navbarHeight = 80;
      const elementPosition = element.offsetTop - navbarHeight;

      // Immediately set active section
      this.activeSection.set(sectionId);

      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth',
      });

      // Double-check after scroll completes
      setTimeout(() => {
        this.updateActiveSection();
      }, 500);
    }
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}
