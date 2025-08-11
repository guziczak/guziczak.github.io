import { Component, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from './layout/navigation/navigation.component';
import { FooterComponent } from './layout/footer/footer.component';
import { PreloaderComponent } from './shared/ui/preloader/preloader.component';
import { ToastComponent } from './shared/ui/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    FooterComponent,
    PreloaderComponent,
    ToastComponent,
  ],
  template: `
    <app-preloader />
    <app-toast />
    <app-navigation />
    <router-outlet />
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
    `,
  ],
})
export class AppComponent {
  // Using signals for reactive state
  public readonly appTitle = signal('Łukasz Guziczak - Portfolio');

  constructor() {
    // Effect to track app initialization
    effect(() => {
      // App initialization logic can be added here if needed
      this.appTitle(); // Keep the signal subscription active
    });
  }
}
