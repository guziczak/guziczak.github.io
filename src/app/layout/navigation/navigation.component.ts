import {
  Component,
  ElementRef,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
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
    <nav
      class="bar"
      aria-label="Primary navigation"
      [class.visible]="pastFold()"
      [attr.aria-hidden]="pastFold() ? null : 'true'"
      [attr.inert]="pastFold() ? null : ''"
    >
      <button type="button" (click)="toTop()" class="bar__mark">
        Łukasz Guziczak
      </button>

      <div class="bar__right">
        <a routerLink="/cv" class="bar__cv">CV</a>

        <div
          class="lang"
          [class.open]="langOpen()"
          (focusout)="onLanguageFocusOut($event)"
        >
          <button
            id="language-trigger"
            type="button"
            class="lang__btn"
            (click)="toggleLang()"
            (keydown)="onLanguageTriggerKeydown($event)"
            [attr.aria-expanded]="langOpen()"
            [attr.aria-label]="'Language: ' + langName()"
            [attr.aria-controls]="langOpen() ? 'language-menu' : null"
            aria-haspopup="listbox"
          >
            <app-flag-icon [lang]="lang()" aria-hidden="true"></app-flag-icon>
            <span>{{ lang().toUpperCase() }}</span>
            <i class="fas fa-chevron-down lang__arrow" aria-hidden="true"></i>
          </button>
          @if (langOpen()) {
            <div
              id="language-menu"
              class="lang__menu"
              role="listbox"
              aria-labelledby="language-trigger"
              (keydown)="onLanguageMenuKeydown($event)"
            >
              <button
                type="button"
                class="lang__item"
                role="option"
                data-lang-option="en"
                (click)="pick('en')"
                [class.active]="lang() === 'en'"
                [attr.aria-selected]="lang() === 'en'"
                tabindex="-1"
              >
                <app-flag-icon lang="en" aria-hidden="true"></app-flag-icon
                ><span>English</span>
              </button>
              <button
                type="button"
                class="lang__item"
                role="option"
                data-lang-option="pl"
                (click)="pick('pl')"
                [class.active]="lang() === 'pl'"
                [attr.aria-selected]="lang() === 'pl'"
                tabindex="-1"
              >
                <app-flag-icon lang="pl" aria-hidden="true"></app-flag-icon
                ><span>Polski</span>
              </button>
              <button
                type="button"
                class="lang__item"
                role="option"
                data-lang-option="de"
                (click)="pick('de')"
                [class.active]="lang() === 'de'"
                [attr.aria-selected]="lang() === 'de'"
                tabindex="-1"
              >
                <app-flag-icon lang="de" aria-hidden="true"></app-flag-icon
                ><span>Deutsch</span>
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
        visibility: hidden;
        transition:
          opacity 0.4s ease,
          transform 0.45s cubic-bezier(0.33, 1, 0.68, 1),
          visibility 0s linear 0.45s;
      }
      .bar.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
        visibility: visible;
        transition-delay: 0s;
      }

      .bar__mark {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
        padding: 0;
        background: none;
        border: 0;
        color: var(--text-primary);
        font-family: inherit;
        font-weight: 600;
        letter-spacing: -0.01em;
        font-size: 0.98rem;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        text-decoration: none;
      }
      .bar__mark:hover { color: var(--text-primary); text-decoration: none; }

      .bar__right {
        display: flex;
        align-items: center;
        flex: 0 0 auto;
        gap: 1.2rem;
      }

      .bar__cv {
        min-width: 44px;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--color-primary);
        border: 1px solid var(--border-color-dark);
        padding: 0 1.1rem;
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
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: none;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        padding: 0 0.6rem;
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
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.65rem 0.75rem;
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

      /* 320–350 px: preserve all three controls without wrapping the signature. */
      @media (max-width: 350px) {
        .bar {
          padding-inline: 0.75rem;
        }
        .bar__mark {
          font-size: 0.9rem;
          letter-spacing: -0.025em;
        }
        .bar__right {
          gap: 0.35rem;
        }
        .bar__cv {
          padding-inline: 0.6rem;
        }
        .lang__btn {
          gap: 0.25rem;
          padding-inline: 0.4rem;
        }
        .lang__btn app-flag-icon {
          display: none;
        }
      }
    `,
  ],
})
export class NavigationComponent {
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  pastFold = signal(false);
  langOpen = signal(false);
  lang = computed(() => this.languageService.currentLanguage());

  constructor() {
    // Reveal the bar once scrolled past ~the fold (or immediately on non-home routes).
    effect((onCleanup) => {
      const update = () => {
        const url = this.router.url;
        const onHome = url === '/' || url === '/home' || url.startsWith('/?') || url.startsWith('/#');
        const visible = !onHome || window.scrollY > window.innerHeight * 0.55;
        const wasVisible = this.pastFold();
        this.pastFold.set(visible);
        if (wasVisible && !visible) this.hideNavigation();
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
        const target = e.target as Element | null;
        if (!target?.closest('.lang')) this.closeLanguageMenu(false);
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
    if (this.langOpen()) {
      this.closeLanguageMenu(false);
      return;
    }
    this.openLanguageMenu('selected');
  }

  onLanguageTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.langOpen()) {
      event.preventDefault();
      this.closeLanguageMenu(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openLanguageMenu(event.key === 'ArrowUp' ? 'last' : 'selected');
    }
  }

  onLanguageMenuKeydown(event: KeyboardEvent): void {
    const options = this.languageOptions();
    if (!options.length) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeLanguageMenu(true);
      return;
    }

    const activeIndex = options.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = (Math.max(activeIndex, -1) + 1) % options.length;
        break;
      case 'ArrowUp':
        nextIndex =
          activeIndex < 0
            ? options.length - 1
            : (activeIndex - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    options[nextIndex].focus();
  }

  onLanguageFocusOut(event: FocusEvent): void {
    const languagePicker = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next && languagePicker.contains(next)) return;

    setTimeout(() => {
      if (!languagePicker.contains(document.activeElement)) {
        this.closeLanguageMenu(false);
      }
    });
  }

  async pick(l: 'en' | 'pl' | 'de'): Promise<void> {
    document.body.classList.add('language-changing', 'fade-out');
    await new Promise((r) => setTimeout(r, 300));
    this.languageService.setLanguage(l);
    this.closeLanguageMenu(true);
    document.body.classList.remove('fade-out');
    document.body.classList.add('fade-in');
    setTimeout(() => document.body.classList.remove('language-changing', 'fade-in'), 400);
  }

  langName(): string {
    const l = this.lang();
    return l === 'en' ? 'English' : l === 'pl' ? 'Polski' : 'Deutsch';
  }

  private openLanguageMenu(focus: 'selected' | 'last'): void {
    this.langOpen.set(true);
    setTimeout(() => {
      const options = this.languageOptions();
      const target =
        focus === 'last'
          ? options.at(-1)
          : options.find(
              (option) => option.dataset['langOption'] === this.lang(),
            ) ?? options[0];
      target?.focus();
    });
  }

  private closeLanguageMenu(restoreFocus: boolean): void {
    if (!this.langOpen()) return;
    this.langOpen.set(false);
    if (restoreFocus) {
      setTimeout(() => this.languageTrigger()?.focus());
    }
  }

  private languageOptions(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.lang__item'),
    );
  }

  private languageTrigger(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>(
      '.lang__btn',
    );
  }

  private hideNavigation(): void {
    this.langOpen.set(false);
    const active = document.activeElement as HTMLElement | null;
    if (active && this.host.nativeElement.contains(active)) active.blur();
  }
}
