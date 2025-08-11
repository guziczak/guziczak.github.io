import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

@Pipe({
  name: 'animatedTranslate',
  standalone: true,
  pure: false
})
export class AnimatedTranslatePipe implements PipeTransform {
  private languageService = inject(LanguageService);
  private cdr = inject(ChangeDetectorRef);
  
  private currentValue = '';
  private previousLang = '';
  private isAnimating = false;
  private animationTimeout?: any;

  transform(key: string, params?: Record<string, any>): string {
    const currentLang = this.languageService.currentLanguage();
    
    // Initial load
    if (!this.previousLang) {
      this.previousLang = currentLang;
      this.currentValue = this.languageService.t(key, params);
      return this.currentValue;
    }
    
    // Language changed
    if (currentLang !== this.previousLang && !this.isAnimating) {
      this.isAnimating = true;
      
      // Clear any existing timeout
      if (this.animationTimeout) {
        clearTimeout(this.animationTimeout);
      }
      
      // Delay the text update to allow fade-out animation
      this.animationTimeout = setTimeout(() => {
        this.previousLang = currentLang;
        this.currentValue = this.languageService.t(key, params);
        this.isAnimating = false;
        this.cdr.markForCheck();
      }, 250); // Match the fade-out duration
      
      // Return current value during animation
      return this.currentValue;
    }
    
    // No language change or currently animating
    if (this.isAnimating) {
      return this.currentValue;
    }
    
    // Update normally
    this.currentValue = this.languageService.t(key, params);
    return this.currentValue;
  }
  
  ngOnDestroy(): void {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }
}