import {
  Directive,
  ElementRef,
  Input,
  inject,
  OnInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { LanguageService } from '../../core/services/language.service';
import { Subscription } from 'rxjs';

/**
 * Translation directive for elements
 * Usage: <p appTranslate="translation.key"></p>
 * With params: <p appTranslate="greeting" [translateParams]="{name: 'John'}"></p>
 * With attribute: <button appTranslate translateAttr="title" translateKey="button.tooltip"></button>
 */
@Directive({
  selector: '[appTranslate]',
  standalone: true,
})
export class TranslateDirective implements OnInit, OnDestroy {
  @Input('appTranslate') key = '';
  @Input() translateParams?: Record<string, any>;
  @Input() translateAttr?: string; // For translating attributes like 'title', 'placeholder'
  @Input() translateKey?: string; // Alternative key when using attribute translation

  private languageService = inject(LanguageService);
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private languageSubscription?: Subscription;

  ngOnInit() {
    this.updateTranslation();

    // Subscribe to language changes
    this.setupLanguageSubscription();
  }

  ngOnDestroy() {
    this.languageSubscription?.unsubscribe();
  }

  private setupLanguageSubscription() {
    // Create effect to react to language changes
    let previousLang = this.languageService.currentLanguage();

    // Use polling approach since we're using signals
    const checkInterval = setInterval(() => {
      const currentLang = this.languageService.currentLanguage();
      if (currentLang !== previousLang) {
        previousLang = currentLang;
        this.updateTranslation();
      }
    }, 100);

    // Store interval ID for cleanup
    this.languageSubscription = {
      unsubscribe: () => clearInterval(checkInterval),
    } as Subscription;
  }

  private updateTranslation() {
    const translationKey = this.translateKey || this.key;

    if (!translationKey) {
      return;
    }

    const translation = this.languageService.t(
      translationKey,
      this.translateParams,
    );

    if (this.translateAttr) {
      // Set attribute value
      this.renderer.setAttribute(
        this.el.nativeElement,
        this.translateAttr,
        translation,
      );
    } else {
      // Set text content
      this.renderer.setProperty(
        this.el.nativeElement,
        'textContent',
        translation,
      );
    }
  }

  /**
   * Update params and refresh translation
   */
  updateParams(params: Record<string, any>) {
    this.translateParams = params;
    this.updateTranslation();
  }
}
