import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="preloader" [class.hidden]="isHidden()">
        <div class="preloader-content">
          <div class="preloader-spinner"></div>
          <div class="preloader-text-container">
            <div
              class="preloader-text"
              [class.fade-out]="isTextTransitioning()"
            >
              {{ currentMessage() }}
            </div>
          </div>
          <div class="preloader-progress">
            <div
              class="progress-bar"
              [style.width.%]="progress()"
              [class.complete]="progress() === 100"
            ></div>
          </div>
        </div>
        @if (showCelebration()) {
          <div class="celebration-text">{{ celebrationMessage() }}</div>
        }
      </div>
    }
  `,
  styles: [
    `
      .preloader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-primary);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        transition:
          opacity 0.5s ease,
          visibility 0.5s ease;
      }

      .preloader.hidden {
        opacity: 0;
        visibility: hidden;
      }

      .preloader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
      }

      .preloader-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(0, 112, 243, 0.2);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .preloader-text-container {
        position: relative;
        height: 30px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .preloader-text {
        font-size: 1.2rem;
        color: var(--text-primary);
        font-weight: 500;
        letter-spacing: 1px;
        animation: slideUp 0.5s ease-out;
        transition: opacity 0.3s ease-out;
      }

      .preloader-text.fade-out {
        opacity: 0;
      }

      @keyframes slideUp {
        from {
          transform: translateY(30px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .preloader-progress {
        width: 200px;
        height: 4px;
        background: rgba(0, 112, 243, 0.1);
        border-radius: 2px;
        overflow: visible;
        position: relative;
        perspective: 1000px;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--color-primary),
          var(--color-secondary)
        );
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .progress-bar.complete {
        animation: salto 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        transform-origin: center;
      }

      @keyframes salto {
        0% {
          transform: translateY(0) rotate(0deg);
        }
        25% {
          transform: translateY(-80px) rotate(180deg);
        }
        50% {
          transform: translateY(-100px) rotate(360deg);
        }
        75% {
          transform: translateY(-80px) rotate(540deg);
        }
        100% {
          transform: translateY(0) rotate(720deg);
        }
      }

      .celebration-text {
        position: fixed;
        top: 50%;
        right: 10px;
        transform: translateY(-50%);
        padding: 20px 40px;
        background: white;
        border: 4px solid #000;
        border-radius: 50px;
        font-size: 1.4rem;
        color: #000;
        font-weight: 900;
        font-family: 'Arial Black', Helvetica, sans-serif;
        animation: slideInFromRight 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        white-space: nowrap;
        box-shadow:
          3px 3px 0 #000,
          6px 6px 15px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .celebration-text::before {
        content: '';
        position: absolute;
        right: -22px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 15px 0 15px 30px;
        border-color: transparent transparent transparent #000;
      }

      .celebration-text::after {
        content: '';
        position: absolute;
        right: -17px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 11px 0 11px 25px;
        border-color: transparent transparent transparent white;
      }

      @keyframes slideInFromRight {
        0% {
          right: -300px;
          opacity: 0;
        }
        70% {
          right: 30px;
        }
        100% {
          right: 20px;
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        .celebration-text {
          right: 10px;
          font-size: 1rem;
          padding: 10px 15px;
        }

        .celebration-text::before {
          border-width: 15px 0 15px 25px;
          right: -22px;
        }

        .celebration-text::after {
          border-width: 11px 0 11px 18px;
          right: -18px;
        }
      }

      @media (max-width: 768px) {
        .preloader-spinner {
          width: 50px;
          height: 50px;
        }

        .preloader-text {
          font-size: 1rem;
        }

        .preloader-progress {
          width: 150px;
        }
      }
    `,
  ],
})
export class PreloaderComponent implements OnInit {
  isVisible = signal(true);
  isHidden = signal(false);
  progress = signal(0);
  currentMessage = signal('Loading...');
  isTextTransitioning = signal(false);
  showCelebration = signal(false);
  celebrationMessage = signal('');
  private celebrationShown = false;

  private celebrationMessages = [
    'SPECTACULAR!!!',
    'HE MADE IT!!!',
    'HOLY SHIT!',
    'ABSOLUTE MADLAD!',
    'LEGENDARY!!!',
    'BOOOOOM!',
    '10/10!!!',
    'SICK FLIP BRO!',
    'OLYMPIC GOLD!',
    'TONY HAWK WHO?',
    'FLAWLESS VICTORY!',
    'NAILED IT!',
    'YEEEEEAH!',
    'NO FUCKING WAY!',
    'INSAAAANE!',
    'WHAT A LEGEND!',
    "HE'S ON FIRE!",
    'SOMEBODY STOP HIM!',
    'CALL 911!',
    'MOM GET THE CAMERA!',
    'WORLD RECORD!',
    'SPECTACULAR!!!',
  ];

  private easterEggs = [
    'Loading...',
    'Compiling the freshest salads...',
    'Deploying antipatterns...',
    'Initializing reactive power station...',
    'Optimizing quantum algorithms...',
    'Reticulating splines...',
    'Generating witty loading messages...',
    'Caffeinating the code...',
    'Teaching pixels to dance...',
    'Convincing bits to behave...',
    'Debugging the debugger...',
    'Deploying rubber ducks...',
    'Refactoring the universe...',
    'Warming up the flux capacitor...',
    'Refueling the rocket...',
    'Dividing by zero... wait, no!',
    'Implementing best practices...',
    'Loading awesome content...',
    'Preparing digital magic...',
    'Assembling the DOM circus...',
    'Feeding the algorithms...',
    'Polishing the pixels...',
    'Waking up the lazy loaders...',
    'Organizing the chaos...',
    'Converting coffee to code...',
    'Summoning the CSS wizards...',
    'Training neural networks to be funny...',
    'Downloading more RAM...',
    'Asking AI for advice...',
    'Procrastinating productively...',
    'Making the impossible possible...',
    'Calculating the meaning of life...',
    'Charging flux capacitors...',
    'Unleashing the kraken...',
    'Baking fresh cookies...',
    'Painting happy little trees...',
    'Negotiating with the servers...',
    'Bribing the cache...',
    'Teaching AI to be human...',
    'Collecting infinity stones...',
    'Warming up electron tubes...',
    'Spinning the hamster wheel...',
    'Compiling sarcastic responses...',
    'Loading loading screen...',
    'Ctrl+C, Ctrl+V magic happening...',
    'Stack Overflow to the rescue...',
    'Trust the process...',
    'Making bugs into features...',
    'Deploying ninja skills...',
    'Sacrificing virgins to the code gods...',
    'Deleting System32... JK!',
    'Hacking the mainframe...',
    'Enabling god mode...',
    'Turning it off and on again...',
    'Googling the solution...',
    'Copy-pasting from production...',
    'YOLO deploying to prod...',
    'Breaking everything gracefully...',
    'Ignoring best practices...',
    'git push --force origin master...',
    'Implementing best antipatterns...',
    'Centering divs...',
    'Writing page in flight, please wait...',
    'Hallucinating (just a little bit)...',
  ];

  private messageIntervalId?: number;
  private progressIntervalId?: number;
  private messageIndex = 0;
  private hasShownEasterEgg = false;

  ngOnInit() {
    this.simulateLoading();
    this.startMessageRotation();
  }

  private startMessageRotation() {
    // Change message every 1200ms so people can read them
    this.messageIntervalId = window.setInterval(() => {
      this.changeMessage();
    }, 1200);
  }

  private changeMessage() {
    // Fade out current message
    this.isTextTransitioning.set(true);

    setTimeout(() => {
      // After first "Loading..." show easter eggs
      if (this.messageIndex === 0 && !this.hasShownEasterEgg) {
        this.hasShownEasterEgg = true;
        // Pick a random easter egg (skip the first "Loading...")
        const randomIndex =
          Math.floor(Math.random() * (this.easterEggs.length - 1)) + 1;
        this.currentMessage.set(this.easterEggs[randomIndex]);
      } else {
        // Cycle through messages randomly
        const randomIndex =
          Math.floor(Math.random() * (this.easterEggs.length - 1)) + 1;
        this.currentMessage.set(this.easterEggs[randomIndex]);
      }

      // Fade in new message
      this.isTextTransitioning.set(false);
    }, 200);
  }

  private simulateLoading() {
    // Simulate loading progress - even slower for more easter eggs!
    this.progressIntervalId = window.setInterval(() => {
      const currentProgress = this.progress();
      if (currentProgress < 100) {
        // Even slower progress to show more messages
        const increment = Math.random() * 5 + 2;
        this.progress.set(Math.min(currentProgress + increment, 100));
      } else {
        clearInterval(this.progressIntervalId!);
        this.showCelebrationOnce();
      }
    }, 300);

    // Hide after 8 seconds to show even more easter eggs
    setTimeout(() => {
      if (this.progressIntervalId) {
        clearInterval(this.progressIntervalId);
      }
      this.progress.set(100);
      this.showCelebrationOnce();
    }, 8000);
  }

  private showCelebrationOnce() {
    // Only show celebration once
    if (this.celebrationShown) return;
    this.celebrationShown = true;

    // Show celebration after salto animation
    setTimeout(() => {
      const randomCelebration =
        this.celebrationMessages[
          Math.floor(Math.random() * this.celebrationMessages.length)
        ];
      this.celebrationMessage.set(randomCelebration);
      this.showCelebration.set(true);
    }, 700);

    // Hide preloader after celebration
    setTimeout(() => {
      this.hidePreloader();
    }, 2000);
  }

  private hidePreloader() {
    // Clear message rotation
    if (this.messageIntervalId) {
      clearInterval(this.messageIntervalId);
    }

    // First set hidden class for fade out animation
    this.isHidden.set(true);

    // Then remove from DOM after animation completes
    setTimeout(() => {
      this.isVisible.set(false);
    }, 500);
  }
}
