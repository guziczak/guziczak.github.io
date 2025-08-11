import { Directive, ElementRef, inject, effect, OnDestroy } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

@Directive({
  selector: '[appLanguageTransition]',
  standalone: true
})
export class LanguageTransitionDirective implements OnDestroy {
  private el = inject(ElementRef);
  private languageService = inject(LanguageService);
  private isTransitioning = false;
  private cleanupFn?: () => void;

  constructor() {
    // Apply initial styles
    this.applyInitialStyles();
    
    // Store initial language
    let isFirstRun = true;
    let previousLang = this.languageService.currentLanguage();
    
    // Create effect to detect language changes
    const effectRef = effect(() => {
      const currentLang = this.languageService.currentLanguage();
      
      // Skip first run
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      
      // Language is about to change
      if (currentLang !== previousLang && !this.isTransitioning) {
        // Start fade out BEFORE the text changes
        this.startFadeOut();
        
        // Wait for fade out, then let the text update happen
        setTimeout(() => {
          previousLang = currentLang;
          // Small delay to ensure DOM has updated
          setTimeout(() => {
            this.startFadeIn();
          }, 50);
        }, 250);
      }
    });
    
    this.cleanupFn = () => effectRef.destroy();
  }

  ngOnDestroy(): void {
    this.cleanupFn?.();
  }

  private applyInitialStyles(): void {
    const element = this.el.nativeElement as HTMLElement;
    element.style.transition = 'opacity 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    element.style.transformOrigin = 'center';
  }

  private startFadeOut(): void {
    if (this.isTransitioning) return;
    
    const element = this.el.nativeElement as HTMLElement;
    this.isTransitioning = true;
    
    // Fade out with fall down
    element.style.opacity = '0';
    element.style.transform = 'translateY(8px) scale(0.98)';
  }

  private startFadeIn(): void {
    const element = this.el.nativeElement as HTMLElement;
    
    // Start from above, then fade in with rise up
    element.style.transform = 'translateY(-8px) scale(0.98)';
    
    // Small delay to ensure the initial position is set
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0) scale(1)';
    }, 10);
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, 260);
  }
}