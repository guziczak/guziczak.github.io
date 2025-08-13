import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { ScrollService } from '../../core/services/scroll.service';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';
import { FlagIconComponent } from '../../shared/ui/flag-icon/flag-icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, FocusTrapDirective, FlagIconComponent],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)' }))
      ])
    ])
  ],
  template: `
    <nav class="navbar" [class.scrolled]="isScrolled()">
      <div class="nav-container">
        <!-- Logo -->
        <a (click)="navigateToHome()" class="logo">
          <img
            src="assets/images/profile.jpg"
            alt="Łukasz Guziczak"
            class="logo-img"
          />
          <span>Łukasz Guziczak</span>
        </a>

        <!-- Desktop Navigation -->
        <ul class="nav-links">
          @for (item of responsiveNavItems(); track item.path) {
            <li class="nav-item">
              <a
                (click)="scrollToSection(item.path)"
                [class.active]="activeSection() === item.path"
                class="nav-link"
              >
                {{ item.label }}
              </a>
            </li>
          }
          <li class="nav-item">
            <a routerLink="/certificates" class="nav-link certs-link">
              <i class="fas fa-certificate"></i>
              <span class="certs-text">Certificates</span>
            </a>
          </li>
          <li class="nav-item cv-nav-item">
            <a routerLink="/cv" class="nav-link">
              <i class="fas fa-file-alt"></i>
              <span>CV</span>
            </a>
          </li>
        </ul>

        <!-- Utility Buttons -->
        <div class="utility-buttons">
          <!-- Language Dropdown -->
          <div class="language-dropdown" [class.open]="isLanguageDropdownOpen()">
            <button
              class="lang-btn"
              (click)="toggleLanguageDropdown()"
              [attr.aria-label]="'Current language: ' + getCurrentLanguageName()"
              [attr.aria-expanded]="isLanguageDropdownOpen()"
              aria-haspopup="listbox"
            >
              <app-flag-icon [lang]="currentLanguage()"></app-flag-icon>
              <span class="lang-code">{{ currentLanguage().toUpperCase() }}</span>
              <i class="fas fa-chevron-down dropdown-arrow"></i>
            </button>
            
            @if (isLanguageDropdownOpen()) {
              <div class="dropdown-menu" role="listbox">
                <button
                  class="dropdown-item"
                  role="option"
                  (click)="selectLanguage('en')"
                  [class.active]="currentLanguage() === 'en'"
                  [attr.aria-selected]="currentLanguage() === 'en'"
                >
                  <app-flag-icon lang="en"></app-flag-icon>
                  <span>English</span>
                  @if (currentLanguage() === 'en') {
                    <i class="fas fa-check check-icon"></i>
                  }
                </button>
                <button
                  class="dropdown-item"
                  role="option"
                  (click)="selectLanguage('pl')"
                  [class.active]="currentLanguage() === 'pl'"
                  [attr.aria-selected]="currentLanguage() === 'pl'"
                >
                  <app-flag-icon lang="pl"></app-flag-icon>
                  <span>Polski</span>
                  @if (currentLanguage() === 'pl') {
                    <i class="fas fa-check check-icon"></i>
                  }
                </button>
                <button
                  class="dropdown-item"
                  role="option"
                  (click)="selectLanguage('de')"
                  [class.active]="currentLanguage() === 'de'"
                  [attr.aria-selected]="currentLanguage() === 'de'"
                >
                  <app-flag-icon lang="de"></app-flag-icon>
                  <span>Deutsch</span>
                  @if (currentLanguage() === 'de') {
                    <i class="fas fa-check check-icon"></i>
                  }
                </button>
              </div>
            }
          </div>

          <!-- Theme Toggle -->
          <button
            class="theme-btn"
            (click)="toggleTheme()"
            [attr.aria-label]="
              'Switch to ' + (isDarkMode() ? 'light' : 'dark') + ' mode'
            "
          >
            <i [class]="'fas fa-' + (isDarkMode() ? 'sun' : 'moon')"></i>
          </button>

          <!-- Mobile Menu Toggle -->
          <button
            class="mobile-menu-btn"
            (click)="toggleMobileMenu()"
            [attr.aria-expanded]="isMobileMenuOpen()"
            aria-label="Toggle mobile menu"
          >
            <i
              [class]="'fas fa-' + (isMobileMenuOpen() ? 'times' : 'bars')"
            ></i>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Menu -->
    @if (isMobileMenuOpen()) {
      <div class="mobile-menu-overlay" (click)="closeMobileMenu()"></div>
      <div class="mobile-nav-menu" [@slideIn] appFocusTrap>
        <div class="mobile-nav-header">
          <div class="mobile-nav-title">Menu</div>
          <button class="mobile-nav-close" (click)="closeMobileMenu()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <ul class="mobile-nav-items">
          @for (item of navItems; track item.path) {
            <li class="mobile-nav-item">
              <a
                (click)="scrollToSection(item.path); closeMobileMenu()"
                class="mobile-nav-link"
                [class.active]="activeSection() === item.path"
              >
                <i [class]="'fas fa-' + item.icon + ' mobile-nav-icon'"></i>
                <span>{{ item.label }}</span>
              </a>
            </li>
          }
          <li class="mobile-nav-item">
            <a
              routerLink="/certificates"
              class="mobile-nav-link"
              (click)="closeMobileMenu()"
            >
              <i class="fas fa-certificate mobile-nav-icon"></i>
              <span>Certificates Page</span>
            </a>
          </li>
          <li class="mobile-nav-item">
            <a
              routerLink="/cv"
              class="mobile-nav-link cv-mobile-link"
              (click)="closeMobileMenu()"
            >
              <i class="fas fa-file-alt mobile-nav-icon"></i>
              <span>CV</span>
            </a>
          </li>
        </ul>
      </div>
    }
  `,
  styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
  private themeService = inject(ThemeService);
  private languageService = inject(LanguageService);
  private scrollService = inject(ScrollService);
  private router = inject(Router);

  // Signals for reactive state
  isScrolled = signal(false);
  isMobileMenuOpen = signal(false);
  isLanguageDropdownOpen = signal(false);

  // Computed signals
  isDarkMode = computed(() => this.themeService.isDarkMode());
  currentLanguage = computed(() => this.languageService.currentLanguage());
  activeSection = computed(() => this.scrollService.currentSection());

  navItems: NavItem[] = [
    { path: 'home', label: 'Home', icon: 'home' },
    { path: 'about', label: 'About', icon: 'user' },
    { path: 'skills', label: 'Skills', icon: 'code' },
    { path: 'projects', label: 'Projects', icon: 'project-diagram' },
    { path: 'achievements', label: 'Achievements', icon: 'trophy' },
    { path: 'games', label: 'Games', icon: 'gamepad' },
    { path: 'testimonials', label: 'Testimonials', icon: 'comments' },
    { path: 'contact', label: 'Contact', icon: 'envelope' },
  ];
  
  // Computed signal for responsive nav labels
  responsiveNavItems = computed(() => {
    const viewport = window.innerWidth;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Special handling for 80% zoom (viewport ~2000px)
    if (viewport >= 1900 && viewport <= 2100) {
      return this.navItems.map(item => ({
        ...item,
        label: item.label === 'Achievements' ? 'Awards' :
               item.label === 'Testimonials' ? 'Reviews' :
               item.label === 'Projects' ? 'Work' :
               item.label
      }));
    }
    
    // For wider viewports that still need shorter labels
    if (viewport > 2100 && viewport <= 2400) {
      return this.navItems.map(item => ({
        ...item,
        label: item.label === 'Achievements' ? 'Awards' :
               item.label === 'Testimonials' ? 'Reviews' :
               item.label
      }));
    }
    
    // For constrained spaces at normal zoom
    if (viewport >= 1024 && viewport < 1400) {
      return this.navItems.map(item => ({
        ...item,
        label: item.label === 'Achievements' ? 'Awards' :
               item.label === 'Testimonials' ? 'Reviews' :
               item.label === 'Projects' ? 'Work' :
               item.label
      }));
    }
    
    return this.navItems;
  });

  constructor() {
    // Effect to handle scroll
    effect(() => {
      const handleScroll = () => {
        this.isScrolled.set(window.scrollY > 50);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    });

    // Close dropdown when clicking outside
    effect(() => {
      if (this.isLanguageDropdownOpen()) {
        const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          if (!target.closest('.language-dropdown')) {
            this.isLanguageDropdownOpen.set(false);
          }
        };

        document.addEventListener('click', handleClickOutside);
        
        return () => {
          document.removeEventListener('click', handleClickOutside);
        };
      }
      return () => {}; // Return empty cleanup when dropdown is closed
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleLanguageDropdown(): void {
    this.isLanguageDropdownOpen.update(state => !state);
  }

  async selectLanguage(lang: 'en' | 'pl' | 'de'): Promise<void> {
    // Add animation class to body for global transition
    document.body.classList.add('language-changing');
    
    // Longer delay for fade out animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.languageService.setLanguage(lang);
    this.isLanguageDropdownOpen.set(false);
    
    // Remove animation class after transition
    setTimeout(() => {
      document.body.classList.remove('language-changing');
    }, 400);
  }

  getCurrentLanguageName(): string {
    const lang = this.currentLanguage();
    switch (lang) {
      case 'en': return 'English';
      case 'pl': return 'Polski';
      case 'de': return 'Deutsch';
      default: return 'English';
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((state) => !state);
    document.body.style.overflow = this.isMobileMenuOpen() ? 'hidden' : '';
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  scrollToSection(sectionId: string): void {
    this.scrollService.scrollToSection(sectionId);
  }

  navigateToHome(): void {
    // Check if we're on the home page
    if (this.router.url === '/' || this.router.url === '/home') {
      // If on home page, scroll to top
      this.scrollToSection('home');
    } else {
      // If on any other page, navigate to home
      this.router.navigate(['/']).then(() => {
        // After navigation, scroll to top
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      });
    }
  }

}
