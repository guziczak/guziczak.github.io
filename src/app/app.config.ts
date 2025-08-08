import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import {
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  withInterceptors,
  withFetch,
} from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless change detection - Angular 20 feature
    provideZonelessChangeDetection(),

    // Router with enhanced features and preloading
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // Animations
    provideAnimationsAsync(),

    // HTTP client with fetch API and interceptors
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, errorInterceptor]),
    ),

    // SSR/Hydration support
    provideClientHydration(),

    // Service Worker for PWA support
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
