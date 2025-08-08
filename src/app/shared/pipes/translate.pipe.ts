import { Pipe, PipeTransform, inject, OnDestroy } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/**
 * Translation pipe for templates
 * Usage: {{ 'translation.key' | translate }}
 * With params: {{ 'greeting' | translate: {name: 'John'} }}
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Make it impure to react to language changes
})
export class TranslatePipe implements PipeTransform {
  private languageService = inject(LanguageService);
  private lastLanguage: string = '';
  private lastKey: string = '';
  private lastValue: string = '';

  transform(key: string, params?: Record<string, any>): string {
    if (!key) {
      return '';
    }

    // Cache optimization - only retranslate if language or key changed
    const currentLanguage = this.languageService.currentLanguage();
    
    if (this.lastKey === key && this.lastLanguage === currentLanguage && !params) {
      return this.lastValue;
    }

    this.lastKey = key;
    this.lastLanguage = currentLanguage;
    this.lastValue = this.languageService.t(key, params);
    
    return this.lastValue;
  }
}