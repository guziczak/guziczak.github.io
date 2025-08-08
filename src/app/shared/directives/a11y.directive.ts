import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  Renderer2,
  HostListener,
} from '@angular/core';

@Directive({
  selector: '[appA11y]',
  standalone: true,
})
export class A11yDirective implements OnInit {
  @Input() ariaLabel?: string;
  @Input() ariaDescribedBy?: string;
  @Input() role?: string;
  @Input() tabIndex?: number;
  @Input() focusable = true;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    const element = this.el.nativeElement;

    // Set ARIA attributes
    if (this.ariaLabel) {
      this.renderer.setAttribute(element, 'aria-label', this.ariaLabel);
    }

    if (this.ariaDescribedBy) {
      this.renderer.setAttribute(
        element,
        'aria-describedby',
        this.ariaDescribedBy,
      );
    }

    if (this.role) {
      this.renderer.setAttribute(element, 'role', this.role);
    }

    // Set tabindex for keyboard navigation
    if (this.focusable && this.tabIndex !== undefined) {
      this.renderer.setAttribute(element, 'tabindex', this.tabIndex.toString());
    }

    // Add focus styles
    this.renderer.addClass(element, 'a11y-focusable');
  }

  @HostListener('keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle Enter and Space for clickable elements
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      this.el.nativeElement.hasAttribute('clickable')
    ) {
      event.preventDefault();
      this.el.nativeElement.click();
    }
  }
}

@Directive({
  selector: '[appSkipLink]',
  standalone: true,
})
export class SkipLinkDirective implements OnInit {
  @Input() skipTo!: string;
  @Input() skipText = 'Skip to content';

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    const element = this.el.nativeElement;

    this.renderer.addClass(element, 'skip-link');
    this.renderer.setAttribute(element, 'href', `#${this.skipTo}`);
    this.renderer.setProperty(element, 'textContent', this.skipText);

    // Focus management
    element.addEventListener('click', (e: Event) => {
      e.preventDefault();
      const target = document.getElementById(this.skipTo);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

// Global styles for accessibility
export const A11Y_STYLES = `
  .a11y-focusable:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--color-primary);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    border-radius: 0 0 4px 0;
    z-index: 10000;
    transition: top 0.2s ease;
  }

  .skip-link:focus {
    top: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
