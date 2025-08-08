import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after tests
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Language initialization', () => {
    it('should default to English', () => {
      expect(service.currentLanguage()).toBe('en');
    });

    it('should detect browser language if supported', () => {
      // Mock navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'pl-PL',
        configurable: true,
      });

      // Create new service instance to trigger detection
      const newService = TestBed.inject(LanguageService);
      expect(newService.currentLanguage()).toBe('pl');
    });

    it('should fall back to English for unsupported languages', () => {
      // Mock navigator.language with unsupported language
      Object.defineProperty(navigator, 'language', {
        value: 'de-DE',
        configurable: true,
      });

      // Create new service instance
      const newService = TestBed.inject(LanguageService);
      expect(newService.currentLanguage()).toBe('en');
    });
  });

  describe('Language switching', () => {
    it('should switch to Polish', () => {
      service.setLanguage('pl');
      expect(service.currentLanguage()).toBe('pl');
    });

    it('should switch to English', () => {
      service.setLanguage('pl'); // First set to Polish
      service.setLanguage('en'); // Then back to English
      expect(service.currentLanguage()).toBe('en');
    });

    it('should persist language preference in localStorage', () => {
      service.setLanguage('pl');
      expect(localStorage.getItem('preferred-language')).toBe('pl');
    });

    it('should load language preference from localStorage', () => {
      localStorage.setItem('preferred-language', 'pl');

      // Create new service instance
      const newService = TestBed.inject(LanguageService);
      expect(newService.currentLanguage()).toBe('pl');
    });
  });

  describe('Translation functionality', () => {
    it('should translate navigation items to English', () => {
      service.setLanguage('en');
      expect(service.t('nav.home')).toBe('Home');
      expect(service.t('nav.about')).toBe('About');
      expect(service.t('nav.skills')).toBe('Skills');
    });

    it('should translate navigation items to Polish', () => {
      service.setLanguage('pl');
      expect(service.t('nav.home')).toBe('Strona główna');
      expect(service.t('nav.about')).toBe('O mnie');
      expect(service.t('nav.skills')).toBe('Umiejętności');
    });

    it('should translate hero section correctly', () => {
      service.setLanguage('en');
      expect(service.t('hero.title')).toBe('Full-stack Developer & Analyst');

      service.setLanguage('pl');
      expect(service.t('hero.title')).toBe('Full-stack Developer i Analityk');
    });

    it('should return key for missing translations', () => {
      const missingKey = 'non.existent.key';
      expect(service.t(missingKey)).toBe(missingKey);
    });

    it('should handle nested translation keys', () => {
      service.setLanguage('en');
      expect(service.t('about.profile.tab')).toBe('Profile');
      expect(service.t('skills.title')).toBe('My Skills');
    });
  });

  describe('Reactive language changes', () => {
    it('should update translations reactively when language changes', () => {
      // Get initial translation
      let translation = service.t('nav.home');
      expect(translation).toBe('Home');

      // Change language
      service.setLanguage('pl');

      // Get translation again
      translation = service.t('nav.home');
      expect(translation).toBe('Strona główna');
    });

    it('should notify all computed signals when language changes', (done) => {
      // Track language changes
      let languageChangeCount = 0;

      // Create effect to track changes
      TestBed.runInInjectionContext(() => {
        const cleanup = service.createLanguageEffect(() => {
          languageChangeCount++;

          if (languageChangeCount === 2) {
            // Initial + one change
            expect(languageChangeCount).toBe(2);
            cleanup();
            done();
          }
        });

        // Trigger language change
        service.setLanguage('pl');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid language switches', () => {
      service.setLanguage('pl');
      service.setLanguage('en');
      service.setLanguage('pl');
      service.setLanguage('en');

      expect(service.currentLanguage()).toBe('en');
      expect(service.t('nav.home')).toBe('Home');
    });

    it('should handle empty translation keys gracefully', () => {
      expect(service.t('')).toBe('');
    });

    it('should maintain translation consistency', () => {
      // Ensure all keys exist in both languages
      const enKeys = Object.keys(service.getAllTranslations('en'));
      const plKeys = Object.keys(service.getAllTranslations('pl'));

      // Both languages should have the same keys
      expect(enKeys.length).toBe(plKeys.length);
      expect(enKeys.sort()).toEqual(plKeys.sort());
    });
  });
});
