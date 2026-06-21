import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';
import { FlagIconComponent } from '../../shared/ui/flag-icon/flag-icon.component';

/**
 * The carved sign — not a neon over the chapel.
 * Nothing at the fold; a quiet obsidian bar fades in once you scroll into the nave.
 * Holds only what must be global: name (back to top), CV, language.
 */
@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, FlagIconComponent],
  template: `
    <nav class="bar" [class.visible]="pastFold()">
      <a (click)="toTop()" class="bar__mark">Łukasz Guziczak</a>

      <div class="bar__right">
        <a routerLink="/cv" class="bar__cv">CV</a>

        <div class="lang" [class.open]="langOpen()">
          <button
            class="lang__btn"
            (click)="toggleLang()"
            [attr.aria-expanded]="langOpen()"
            [attr.aria-label]="'Language: ' + langName()"
            aria-haspopup="listbox"
          >
            <app-flag-icon [lang]="lang()"></app-flag-icon>
            <span>{{ lang().toUpperCase() }}</span>
            <i class="fas fa-chevron-down lang__arrow"></i>
          </button>
          @if (langOpen()) {
            <div class="lang__menu" role="listbox">
              <button class="lang__item" role="option" (click)="pick('en')" [class.active]="lang() === 'en'">
                <app-flag-icon lang="en"></app-flag-icon><span>English</span>
              </button>
              <button class="lang__item" role="option" (click)="pick('pl')" [class.active]="lang() === 'pl'">
                <app-flag-icon lang="pl"></app-flag-icon><span>Polski</span>
              </button>
              <button class="lang__item" role="option" (click)="pick('de')" [class.active]="lang() === 'de'">
                <app-flag-icon lang="de"></app-flag-icon><span>Deutsch</span>
              </button>
            </div>
          }
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      .bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 clamp(1.5rem, 5vw, 4rem);
        background: rgba(11, 17, 32, 0.72);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border-color);
        opacity: 0;
        transform: translateY(-100%);
        pointer-events: none;
        transition: opacity 0.4s ease, transform 0.45s cubic-bezier(0.33, 1, 0.68, 1);
      }
      .bar.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .bar__mark {
        color: var(--text-primary);
        font-weight: 600;
        letter-spacing: -0.01em;
        font-size: 0.98rem;
        cursor: pointer;
        text-decoration: none;
      }
      .bar__mark:hover { color: var(--text-primary); text-decoration: none; }

      .bar__right { display: flex; align-items: center; gap: 1.2rem; }

      .bar__cv {
        color: var(--color-primary);
        border: 1px solid var(--border-color-dark);
        padding: 0.4rem 1.1rem;
        border-radius: var(--radius-full);
        font-size: 0.9rem;
        text-decoration: none;
        transition: border-color 0.25s ease, background-color 0.25s ease;
      }
      .bar__cv:hover {
        border-color: var(--color-primary);
        background: rgba(56, 189, 248, 0.08);
        text-decoration: none;
      }

      .lang { position: relative; }
      .lang__btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: none;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        padding: 0.35rem 0.6rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.82rem;
        transition: color 0.25s ease, border-color 0.25s ease;
      }
      .lang__btn:hover { color: var(--text-primary); border-color: var(--border-color-dark); }
      .lang__arrow { font-size: 0.65rem; transition: transform 0.25s ease; }
      .lang.open .lang__arrow { transform: rotate(180deg); }

      .lang__menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.5rem);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 0.4rem;
        min-width: 150px;
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .lang__item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.6rem;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: 0.9rem;
        text-align: left;
        width: 100%;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      .lang__item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
      .lang__item.active { color: var(--color-primary); }
    `,
  ],
})
export class NavigationComponent {
  private languageService = inject(LanguageService);
  private router = inject(Router);

  pastFold = signal(false);
  langOpen = signal(false);
  lang = computed(() => this.languageService.currentLanguage());

  constructor() {
    // Reveal the bar once scrolled past ~the fold (or immediately on non-home routes).
    effect((onCleanup) => {
      const update = () => {
        const url = this.router.url;
        const onHome = url === '/' || url === '/home' || url.startsWith('/?') || url.startsWith('/#');
        this.pastFold.set(!onHome || window.scrollY > window.innerHeight * 0.55);
      };
      window.addEventListener('scroll', update, { passive: true });
      const sub = this.router.events.subscribe(() => update());
      update();
      onCleanup(() => {
        window.removeEventListener('scroll', update);
        sub.unsubscribe();
      });
    });

    // Close the language menu on outside click.
    effect((onCleanup) => {
      if (!this.langOpen()) return;
      const onClick = (e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest('.lang')) this.langOpen.set(false);
      };
      document.addEventListener('click', onClick);
      onCleanup(() => document.removeEventListener('click', onClick));
    });
  }

  toTop(): void {
    const url = this.router.url;
    if (url === '/' || url === '/home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.router.navigate(['/']).then(() =>
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100),
      );
    }
  }

  toggleLang(): void {
    this.langOpen.update((v) => !v);
  }

  async pick(l: 'en' | 'pl' | 'de'): Promise<void> {
    document.body.classList.add('language-changing', 'fade-out');
    await new Promise((r) => setTimeout(r, 300));
    this.languageService.setLanguage(l);
    this.langOpen.set(false);
    document.body.classList.remove('fade-out');
    document.body.classList.add('fade-in');
    setTimeout(() => document.body.classList.remove('language-changing', 'fade-in'), 400);
  }

  langName(): string {
    const l = this.lang();
    return l === 'en' ? 'English' : l === 'pl' ? 'Polski' : 'Deutsch';
  }
}
