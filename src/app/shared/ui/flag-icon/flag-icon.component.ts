import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type FlagCode = 'en' | 'pl' | 'de';

@Component({
  selector: 'app-flag-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (flag()) {
      @case ('en') {
        <svg
          class="flag-icon"
          viewBox="0 0 60 30"
          xmlns="http://www.w3.org/2000/svg"
          [attr.aria-label]="ariaLabel()"
          role="img"
        >
          <title>{{ ariaLabel() }}</title>
          <!-- UK Flag -->
          <rect width="60" height="30" fill="#012169" />
          <!-- White diagonal cross -->
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
          <!-- Red diagonal cross -->
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4" />
          <!-- White cross -->
          <path d="M30,0 L30,30 M0,15 L60,15" stroke="#fff" stroke-width="10" />
          <!-- Red cross -->
          <path d="M30,0 L30,30 M0,15 L60,15" stroke="#C8102E" stroke-width="6" />
        </svg>
      }
      @case ('pl') {
        <svg
          class="flag-icon"
          viewBox="0 0 60 30"
          xmlns="http://www.w3.org/2000/svg"
          [attr.aria-label]="ariaLabel()"
          role="img"
        >
          <title>{{ ariaLabel() }}</title>
          <!-- Polish Flag -->
          <rect width="60" height="15" fill="#fff" />
          <rect y="15" width="60" height="15" fill="#DC143C" />
        </svg>
      }
      @case ('de') {
        <svg
          class="flag-icon"
          viewBox="0 0 60 30"
          xmlns="http://www.w3.org/2000/svg"
          [attr.aria-label]="ariaLabel()"
          role="img"
        >
          <title>{{ ariaLabel() }}</title>
          <!-- German Flag -->
          <rect width="60" height="10" fill="#000" />
          <rect y="10" width="60" height="10" fill="#D00" />
          <rect y="20" width="60" height="10" fill="#FFCE00" />
        </svg>
      }
      @default {
        <!-- Fallback: Text -->
        <span class="flag-text" [attr.aria-label]="ariaLabel()">{{
          flag().toUpperCase()
        }}</span>
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .flag-icon {
        width: 24px;
        height: auto;
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
        display: block;
      }

      .flag-text {
        font-weight: 600;
        font-size: 0.875rem;
        padding: 0.25rem 0.5rem;
        background: var(--bg-secondary);
        border-radius: 4px;
        color: var(--text-primary);
      }

      /* Hover effect */
      :host(:hover) .flag-icon {
        box-shadow: 0 0 0 2px var(--color-primary-light);
      }

      /* Focus styles for accessibility */
      :host(:focus-within) .flag-icon {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      /* Animation */
      .flag-icon {
        transition: all 0.2s ease;
      }

      :host(:active) .flag-icon {
        transform: scale(0.95);
      }
    `,
  ],
})
export class FlagIconComponent {
  // Use signal with setter for proper reactivity
  private _lang = signal<FlagCode>('en');
  
  @Input() 
  set lang(value: FlagCode) {
    this._lang.set(value);
  }
  get lang(): FlagCode {
    return this._lang();
  }

  // Signal for the flag
  flag = computed(() => this._lang());

  // Computed aria label
  ariaLabel = computed(() => {
    const labels: Record<FlagCode, string> = {
      en: 'English language flag',
      pl: 'Polish language flag',
      de: 'German language flag',
    };
    return labels[this.flag()] || `${this.flag()} flag`;
  });
}