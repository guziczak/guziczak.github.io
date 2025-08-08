import { Injectable, signal, effect, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Signal for reactive theme state
  private theme = signal<'light' | 'dark'>('light');

  // Public computed signal
  public isDarkMode = computed(() => this.theme() === 'dark');

  // Observable for theme changes (for compatibility)
  public isDarkMode$ = toObservable(this.isDarkMode);

  constructor() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;

    this.theme.set(savedTheme || (prefersDark ? 'dark' : 'light'));

    // Effect to update DOM and localStorage when theme changes
    effect(() => {
      const currentTheme = this.theme();
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('theme', currentTheme);

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name=theme-color]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute(
          'content',
          currentTheme === 'dark' ? '#111827' : '#ffffff',
        );
      }
    });

    // Listen for system theme changes
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          this.theme.set(e.matches ? 'dark' : 'light');
        }
      });
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme.set(theme);
  }
}
