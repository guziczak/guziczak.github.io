import { Injectable, signal, effect, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Language = 'en' | 'pl' | 'de';
export type TranslationData = Record<string, any>;

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private http = inject(HttpClient);

  // Signals for reactive state
  private language = signal<Language>('en');
  private translations = signal<TranslationData>({});
  private isLoading = signal<boolean>(false);
  private cache = new Map<Language, TranslationData>();

  // Public signals
  public currentLanguage = this.language.asReadonly();
  public loading = this.isLoading.asReadonly();
  public ready = computed(
    () => !this.isLoading() && Object.keys(this.translations()).length > 0,
  );

  // For backward compatibility with old components
  public isDarkMode$ = this.currentLanguage;

  constructor() {
    // Initialize language from storage or browser
    const savedLang = localStorage.getItem('language') as Language | null;
    const browserLang = navigator.language.substring(0, 2);
    const supportedLanguages: Language[] = ['en', 'pl', 'de'];
    
    // Determine initial language
    let initialLang: Language = 'en';
    if (savedLang && supportedLanguages.includes(savedLang)) {
      initialLang = savedLang;
    } else if (supportedLanguages.includes(browserLang as Language)) {
      initialLang = browserLang as Language;
    }
    
    // Set initial language
    this.language.set(initialLang);
    document.documentElement.setAttribute('lang', initialLang);
    
    // Load initial translations synchronously if possible
    this.loadTranslations(initialLang);

    // React to language changes (skip first emission)
    let isFirstEmission = true;
    effect(() => {
      const currentLang = this.language();
      
      if (isFirstEmission) {
        isFirstEmission = false;
        return;
      }
      
      localStorage.setItem('language', currentLang);
      document.documentElement.setAttribute('lang', currentLang);
      this.loadTranslations(currentLang);
    });
  }

  /**
   * Get translation for a key with nested path support
   */
  t(key: string, params?: Record<string, any>): string {
    const translation = this.getNestedTranslation(key);

    if (!translation) {
      // Fallback to old key format for backward compatibility
      const oldKey = key.replace(/\./g, '_');
      const oldTranslation = this.translations()[oldKey];
      if (oldTranslation) return oldTranslation;

      console.warn(`Missing translation: ${key}`);
      return key;
    }

    // Handle parameterized translations
    if (params && typeof translation === 'string') {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Get nested translation value
   */
  private getNestedTranslation(key: string): any {
    const keys = key.split('.');
    let value: any = this.translations();

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Interpolate parameters in translation string
   */
  private interpolate(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Load translations for a language
   */
  private async loadTranslations(lang: Language): Promise<void> {
    // Check cache first
    if (this.cache.has(lang)) {
      this.translations.set(this.cache.get(lang)!);
      return;
    }

    this.isLoading.set(true);

    try {
      // Load from assets/i18n directory
      const translations = await firstValueFrom(
        this.http.get<TranslationData>(`/assets/i18n/${lang}.json`),
      );

      this.cache.set(lang, translations);
      this.translations.set(translations);
    } catch (error) {
      console.warn(
        `Failed to load translations from assets/i18n/${lang}.json, using embedded fallback`,
      );
      // Use embedded translations as fallback
      const fallback = this.getEmbeddedTranslations(lang);
      this.cache.set(lang, fallback);
      this.translations.set(fallback);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle between available languages (cycles through en -> pl -> de -> en)
   */
  async toggleLanguage(): Promise<void> {
    const currentLang = this.language();
    let newLang: Language;
    
    // Cycle through languages: en -> pl -> de -> en
    switch (currentLang) {
      case 'en':
        newLang = 'pl';
        break;
      case 'pl':
        newLang = 'de';
        break;
      case 'de':
        newLang = 'en';
        break;
      default:
        newLang = 'en';
    }
    
    // Pre-load translations if not cached
    if (!this.cache.has(newLang)) {
      await this.loadTranslations(newLang);
    }
    
    // Now switch language
    this.language.set(newLang);
    localStorage.setItem('language', newLang);
  }

  /**
   * Set specific language
   */
  setLanguage(language: Language): void {
    this.language.set(language);
  }

  /**
   * Get all translations for a specific language (for testing)
   */
  getAllTranslations(lang: Language): TranslationData {
    return this.cache.get(lang) || {};
  }

  /**
   * Add or update translations dynamically
   */
  addTranslations(language: Language, translations: TranslationData): void {
    const current = this.cache.get(language) || {};
    const merged = { ...current, ...translations };
    this.cache.set(language, merged);

    if (this.language() === language) {
      this.translations.set(merged);
    }
  }

  /**
   * Create language effect (for testing reactive changes)
   */
  createLanguageEffect(callback: () => void): () => void {
    const effectRef = effect(() => {
      this.currentLanguage();
      callback();
    });

    return () => effectRef.destroy();
  }

  /**
   * Get embedded translations (fallback - now returns empty object since translations are in JSON files)
   */
  private getEmbeddedTranslations(lang: Language): TranslationData {
    console.warn(
      `Using empty fallback translations for language: ${lang}. Ensure /assets/i18n/${lang}.json is accessible.`,
    );
    return {};
  }
}
