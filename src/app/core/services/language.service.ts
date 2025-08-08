import { Injectable, signal, effect, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Language = 'en' | 'pl';
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
  public ready = computed(() => !this.isLoading() && Object.keys(this.translations()).length > 0);
  
  // For backward compatibility with old components
  public isDarkMode$ = this.currentLanguage;

  constructor() {
    // Initialize language from storage or browser
    const savedLang = localStorage.getItem('language') as Language | null;
    const browserLang = navigator.language.substring(0, 2) as Language;
    this.language.set(savedLang || (browserLang === 'pl' ? 'pl' : 'en'));
    
    // Load initial translations
    this.loadTranslations(this.language());
    
    // React to language changes
    effect(() => {
      const currentLang = this.language();
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
      // Try to load from HTTP
      const translations = await firstValueFrom(
        this.http.get<TranslationData>(`/translations/${lang}.json`)
      );
      
      this.cache.set(lang, translations);
      this.translations.set(translations);
    } catch (error) {
      console.warn(`Failed to load translations from HTTP, using embedded fallback`);
      // Use embedded translations as fallback
      const fallback = this.getEmbeddedTranslations(lang);
      this.cache.set(lang, fallback);
      this.translations.set(fallback);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle between available languages
   */
  toggleLanguage(): void {
    this.language.update((current) => (current === 'en' ? 'pl' : 'en'));
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
   * Get embedded translations (fallback)
   */
  private getEmbeddedTranslations(lang: Language): TranslationData {
    const translations: Record<Language, TranslationData> = {
      en: {
        // Navigation
        nav: {
          home: 'Home',
          about: 'About',
          skills: 'Skills',
          projects: 'Projects',
          games: 'Games',
          certificates: 'Certificates',
          contact: 'Contact',
          cv: 'CV'
        },
        // Hero section
        hero: {
          title: 'Full-stack Developer & Analyst',
          subtitle: 'Turning Ideas into Digital Reality',
          description: 'Passionate about creating efficient, scalable solutions with modern technologies. I specialize in Java, Python, React, and cloud infrastructure development.',
          cta: {
            contact: 'Contact Me',
            projects: 'View Projects',
            cv: 'View CV'
          }
        },
        // About section
        about: {
          title: 'About Me',
          profile: {
            tab: 'Profile',
            title: 'Full-stack Developer & Analyst'
          },
          experience: { tab: 'Experience' },
          education: { tab: 'Education' },
          description: "I'm a Full-stack Developer and Analyst with a passion for building efficient and scalable applications. With extensive experience in both front-end and back-end technologies, I enjoy solving complex problems and optimizing systems.",
          location: 'Wrocław, Poland',
          languages: 'Polish (Native), English (Fluent)',
          interests: 'Technology, AI/ML, Gaming, Electronics',
          yearsExperience: 'Years Experience',
          projectsCompleted: 'Projects Completed',
          technologies: 'Technologies'
        },
        // Skills section
        skills: {
          title: 'My Skills',
          subtitle: 'Technologies and tools I work with to build efficient solutions',
          note: 'Skill levels represent proficiency and experience with each technology'
        },
        // Projects section
        projects: {
          title: 'Recent Projects',
          subtitle: 'A selection of my recent work and contributions',
          filter: { all: 'All' },
          noProjects: 'No projects found for the selected filter'
        },
        // Achievements
        achievements: {
          title: 'Key Achievements',
          subtitle: 'Milestones and accomplishments throughout my career'
        },
        // Games section
        games: {
          title: 'My Games',
          subtitle: "Fun browser-based games I've created in my spare time",
          play: 'Play',
          code: 'Code',
          note: 'All games are built with vanilla JavaScript and run directly in your browser'
        },
        // Certificates section
        certificates: {
          title: 'Certificates',
          subtitle: 'Professional certifications and completed courses',
          filter: { all: 'All' },
          credential: 'Credential ID',
          view: 'View Certificate',
          noCertificates: 'No certificates found for the selected category'
        },
        // Testimonials section
        testimonials: {
          title: 'Recommendations',
          subtitle: 'What colleagues say about working with me'
        },
        // Contact section
        contact: {
          title: 'Contact Me',
          subtitle: "Let's discuss your next project",
          getInTouch: 'Get In Touch',
          location: 'Wrocław, Poland',
          sendMessage: 'Send Me a Message',
          letsConnect: "Let's Connect",
          cardText: "Feel free to reach out for job opportunities, collaborations, or just to say hello. I'm always interested in new projects and challenges!",
          modalTitle: 'Contact Me',
          yourName: 'Your Name',
          yourEmail: 'Your Email',
          subject: 'Subject',
          yourMessage: 'Your Message',
          send: 'Send Message',
          successTitle: 'Message Sent!',
          successMessage: "Thank you for reaching out. I'll get back to you soon.",
          done: 'Done'
        },
        // Common
        common: {
          download: 'Download',
          viewAll: 'View All',
          loading: 'Loading...',
          error: 'Error occurred',
          retry: 'Retry'
        }
      },
      pl: {
        // Navigation
        nav: {
          home: 'Strona główna',
          about: 'O mnie',
          skills: 'Umiejętności',
          projects: 'Projekty',
          games: 'Gry',
          certificates: 'Certyfikaty',
          contact: 'Kontakt',
          cv: 'CV'
        },
        // Hero section
        hero: {
          title: 'Programista Full-stack & Analityk',
          subtitle: 'Przekształcam Pomysły w Cyfrową Rzeczywistość',
          description: 'Z pasją tworzę wydajne, skalowalne rozwiązania wykorzystując nowoczesne technologie. Specjalizuję się w Java, Python, React oraz infrastrukturze chmurowej.',
          cta: {
            contact: 'Kontakt',
            projects: 'Zobacz Projekty',
            cv: 'Zobacz CV'
          }
        },
        // About section
        about: {
          title: 'O Mnie',
          profile: {
            tab: 'Profil',
            title: 'Programista Full-stack & Analityk'
          },
          experience: { tab: 'Doświadczenie' },
          education: { tab: 'Wykształcenie' },
          description: 'Jestem Programistą Full-stack i Analitykiem z pasją do budowania wydajnych i skalowalnych aplikacji. Z rozległym doświadczeniem w technologiach front-end i back-end, lubię rozwiązywać złożone problemy i optymalizować systemy.',
          location: 'Wrocław, Polska',
          languages: 'Polski (Ojczysty), Angielski (Biegły)',
          interests: 'Technologia, AI/ML, Gaming, Elektronika',
          yearsExperience: 'Lat Doświadczenia',
          projectsCompleted: 'Ukończonych Projektów',
          technologies: 'Technologii'
        },
        // Skills section
        skills: {
          title: 'Moje Umiejętności',
          subtitle: 'Technologie i narzędzia, z którymi pracuję tworząc wydajne rozwiązania',
          note: 'Poziomy umiejętności reprezentują biegłość i doświadczenie w każdej technologii'
        },
        // Projects section
        projects: {
          title: 'Ostatnie Projekty',
          subtitle: 'Wybór moich ostatnich prac i projektów',
          filter: { all: 'Wszystkie' },
          noProjects: 'Brak projektów dla wybranego filtra'
        },
        // Achievements
        achievements: {
          title: 'Kluczowe Osiągnięcia',
          subtitle: 'Kamienie milowe i osiągnięcia w mojej karierze'
        },
        // Games section
        games: {
          title: 'Moje Gry',
          subtitle: 'Zabawne gry przeglądarkowe, które stworzyłem w wolnym czasie',
          play: 'Graj',
          code: 'Kod',
          note: 'Wszystkie gry są zbudowane w czystym JavaScript i działają bezpośrednio w przeglądarce'
        },
        // Certificates section
        certificates: {
          title: 'Certyfikaty',
          subtitle: 'Certyfikaty zawodowe i ukończone kursy',
          filter: { all: 'Wszystkie' },
          credential: 'ID Certyfikatu',
          view: 'Zobacz Certyfikat',
          noCertificates: 'Brak certyfikatów dla wybranej kategorii'
        },
        // Testimonials section
        testimonials: {
          title: 'Rekomendacje',
          subtitle: 'Co koledzy mówią o współpracy ze mną'
        },
        // Contact section
        contact: {
          title: 'Kontakt',
          subtitle: 'Porozmawiajmy o Twoim następnym projekcie',
          getInTouch: 'Skontaktuj się',
          location: 'Wrocław, Polska',
          sendMessage: 'Wyślij Wiadomość',
          letsConnect: 'Połączmy się',
          cardText: 'Skontaktuj się w sprawie ofert pracy, współpracy lub po prostu żeby się przywitać. Zawsze jestem zainteresowany nowymi projektami i wyzwaniami!',
          modalTitle: 'Kontakt',
          yourName: 'Twoje Imię',
          yourEmail: 'Twój Email',
          subject: 'Temat',
          yourMessage: 'Twoja Wiadomość',
          send: 'Wyślij Wiadomość',
          successTitle: 'Wiadomość Wysłana!',
          successMessage: 'Dziękuję za kontakt. Odpowiem wkrótce.',
          done: 'Gotowe'
        },
        // Common
        common: {
          download: 'Pobierz',
          viewAll: 'Zobacz wszystkie',
          loading: 'Ładowanie...',
          error: 'Wystąpił błąd',
          retry: 'Spróbuj ponownie'
        }
      }
    };
    
    return translations[lang];
  }
}