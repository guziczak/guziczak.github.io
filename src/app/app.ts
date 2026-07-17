import { Component, signal, effect, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from './layout/navigation/navigation.component';
import { FooterComponent } from './layout/footer/footer.component';
import { ToastComponent } from './shared/ui/toast/toast.component';
import { LanguageService } from './core/services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    FooterComponent,
    ToastComponent,
  ],
  template: `
    <a class="skip-link" href="#main-content">{{ skipLabel() }}</a>
    <app-toast />
    <app-navigation />
    <main id="main-content" class="main-content" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .main-content {
        flex: 1;
        width: 100%;
      }

      .skip-link {
        position: fixed;
        top: max(0.75rem, env(safe-area-inset-top));
        left: max(0.75rem, env(safe-area-inset-left));
        z-index: 10000;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        padding: 0.65rem 1rem;
        border-radius: 0.5rem;
        background: var(--color-primary);
        color: var(--text-inverse);
        font-weight: 700;
        text-decoration: none;
        transform: translateY(calc(-100% - 2rem));
        transition: transform 0.2s ease;
      }

      .skip-link:focus-visible {
        transform: translateY(0);
        outline: 2px solid var(--text-primary);
        outline-offset: 3px;
      }
    `,
  ],
})
export class AppComponent {
  private readonly languageService = inject(LanguageService);

  // Using signals for reactive state
  public readonly appTitle = signal('Łukasz Guziczak - Portfolio');
  protected readonly skipLabel = computed(() => {
    const labels: Record<string, string> = {
      en: 'Skip to content',
      pl: 'Przejdź do treści',
      de: 'Zum Inhalt springen',
    };
    return labels[this.languageService.currentLanguage()] ?? labels['en'];
  });

  constructor() {
    // Effect to track app initialization
    effect(() => {
      // App initialization logic can be added here if needed
      this.appTitle(); // Keep the signal subscription active
    });
  }
}
