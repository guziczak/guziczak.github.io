import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text-container">
        <p class="loading-text" [class.fade-out]="isTransitioning()">
          {{ currentMessage() }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 2rem;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--bg-tertiary);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 2s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text-container {
      position: relative;
      height: 24px;
      overflow: hidden;
    }

    .loading-text {
      font-size: 1rem;
      color: var(--text-secondary);
      margin: 0;
      animation: slideUp 0.8s ease-out;
      transition: opacity 0.5s ease-out;
    }

    .loading-text.fade-out {
      opacity: 0;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class LoadingSpinnerComponent implements OnInit, OnDestroy {
  private easterEggs = [
    'Loading...',
    'Compiling the freshest salads...',
    'Initializing reactive power station...',
    'Optimizing quantum algorithms...',
    'Generating witty loading messages...',
    'Caffeinating the code...',
    'Teaching pixels to dance...',
    'Convincing bits to behave...',
    'Debugging the debugger...',
    'Deploying rubber ducks...',
    'Refactoring the universe...',
    'Warming up the flux capacitor...',
    'Dividing by zero... wait, no!',
    'Implementing best practices...',
    'Preparing digital magic...',
    'Feeding the algorithms...',
    'Polishing the pixels...',
    'Waking up the lazy loaders...',
    'Organizing the chaos...',
    'Converting coffee to code...',
    'Summoning the CSS wizards...',
    'Training neural networks to be funny...',
    'Downloading more RAM...',
    'Asking AI for advice...',
  ];

  currentMessage = signal('Loading...');
  isTransitioning = signal(false);

  private intervalId?: number;
  private messageIndex = 0;
  private hasShownEasterEgg = false;

  ngOnInit() {
    // Start with normal loading, then show easter eggs
    this.intervalId = window.setInterval(() => {
      this.changeMessage();
    }, 6000);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private changeMessage() {
    // Fade out current message
    this.isTransitioning.set(true);

    setTimeout(() => {
      // After first "Loading..." show easter eggs
      if (this.messageIndex === 0 && !this.hasShownEasterEgg) {
        this.hasShownEasterEgg = true;
        // Pick a random easter egg (skip the first "Loading...")
        const randomIndex = Math.floor(Math.random() * (this.easterEggs.length - 1)) + 1;
        this.currentMessage.set(this.easterEggs[randomIndex]);
      } else {
        // Cycle through all messages
        this.messageIndex = (this.messageIndex + 1) % this.easterEggs.length;
        // Skip the default "Loading..." after we've shown easter eggs
        if (this.messageIndex === 0 && this.hasShownEasterEgg) {
          this.messageIndex = 1;
        }
        this.currentMessage.set(this.easterEggs[this.messageIndex]);
      }

      // Fade in new message
      this.isTransitioning.set(false);
    }, 500);
  }
}
