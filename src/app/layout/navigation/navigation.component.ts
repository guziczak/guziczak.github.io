import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { ScrollService } from '../../core/services/scroll.service';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, FocusTrapDirective],
  template: `
    <nav class="navbar" [class.scrolled]="isScrolled()">
      <div class="container nav-container">
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
          @for (item of navItems; track item.path) {
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
            <a routerLink="/certificates" class="nav-link">
              <i class="fas fa-certificate"></i> Certificates
            </a>
          </li>
          <li class="nav-item cv-nav-item">
            <a routerLink="/cv" class="nav-link">
              <i class="fas fa-file-alt"></i> CV
            </a>
          </li>
        </ul>

        <!-- Utility Buttons -->
        <div class="utility-buttons">
          <!-- Language Switcher -->
          <button
            class="lang-btn"
            (click)="toggleLanguage()"
            [attr.aria-label]="
              'Switch language to ' +
              (currentLanguage() === 'en' ? 'Polski' : 'English')
            "
          >
            <img
              [src]="'assets/flags/' + currentLanguage() + '.svg'"
              [alt]="currentLanguage() === 'en' ? 'English' : 'Polski'"
            />
          </button>

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
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
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
