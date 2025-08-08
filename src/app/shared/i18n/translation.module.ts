import { NgModule } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslateDirective } from '../directives/translate.directive';

/**
 * Translation module that exports all i18n related components
 * Import this module in components that need translation support
 */
@NgModule({
  imports: [TranslatePipe, TranslateDirective],
  exports: [TranslatePipe, TranslateDirective]
})
export class TranslationModule {}

/**
 * Standalone imports for modern Angular
 */
export const I18N_IMPORTS = [TranslatePipe, TranslateDirective] as const;