import {
  Directive,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true,
})
export class FocusTrapDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private focusableElements: HTMLElement[] = [];
  private firstFocusableElement: HTMLElement | null = null;
  private lastFocusableElement: HTMLElement | null = null;

  ngOnInit() {
    this.initializeFocusTrap();
  }

  private initializeFocusTrap() {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input[type="text"]:not([disabled])',
      'input[type="email"]:not([disabled])',
      'input[type="password"]:not([disabled])',
      'input[type="tel"]:not([disabled])',
      'input[type="search"]:not([disabled])',
      'input[type="url"]:not([disabled])',
      'input[type="number"]:not([disabled])',
      'input[type="checkbox"]:not([disabled])',
      'input[type="radio"]:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const element = this.el.nativeElement as HTMLElement;
    const elements = element.querySelectorAll(focusableSelectors.join(', '));
    this.focusableElements = Array.from(elements).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el.offsetParent !== null,
    );

    if (this.focusableElements.length > 0) {
      this.firstFocusableElement = this.focusableElements[0];
      this.lastFocusableElement =
        this.focusableElements[this.focusableElements.length - 1];

      // Focus first element
      setTimeout(() => {
        this.firstFocusableElement?.focus();
      }, 100);
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      if (!this.focusableElements.length) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === this.firstFocusableElement) {
          event.preventDefault();
          this.lastFocusableElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === this.lastFocusableElement) {
          event.preventDefault();
          this.firstFocusableElement?.focus();
        }
      }
    }

    if (event.key === 'Escape') {
      // Emit close event if needed
      const closeButton = this.el.nativeElement.querySelector(
        '[aria-label*="Close"], .close, .modal-close',
      );
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    }
  }

  ngOnDestroy() {
    // Return focus to previously focused element if needed
  }
}
