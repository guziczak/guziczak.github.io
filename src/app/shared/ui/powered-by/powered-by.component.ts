import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-powered-by',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="powered-by">
      <span class="powered-text">Powered by</span>
      <div class="angular-logo">
        <svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg">
          <polygon points="125,30 125,30 125,30 31.9,63.2 46.1,186.3 125,230 125,230 125,230 203.9,186.3 218.1,63.2" fill="#dd0031"/>
          <polygon points="125,30 125,52.2 125,52.1 125,153.4 125,153.4 125,230 125,230 203.9,186.3 218.1,63.2 125,30" fill="#c3002f"/>
          <path d="M125,52.1L66.8,182.6h0h21.7h0l11.7-29.2h49.4l11.7,29.2h0h21.7h0L125,52.1L125,52.1L125,52.1L125,52.1L125,52.1z M142,135.4H108l17-40.9L142,135.4z" fill="#ffffff"/>
        </svg>
      </div>
      <span class="angular-text">Angular</span>
      <span class="version">v20</span>
    </div>
  `,
  styles: [`
    .powered-by {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, rgba(221, 0, 49, 0.05) 0%, rgba(195, 0, 47, 0.05) 100%);
      border: 1px solid rgba(221, 0, 49, 0.2);
      border-radius: 2rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
      backdrop-filter: blur(10px);
      animation: fadeInUp 0.8s ease-out;
    }

    .powered-by:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(221, 0, 49, 0.15);
      background: linear-gradient(135deg, rgba(221, 0, 49, 0.08) 0%, rgba(195, 0, 47, 0.08) 100%);
      border-color: rgba(221, 0, 49, 0.3);
    }

    .powered-text {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-weight: 400;
      letter-spacing: 0.02em;
    }

    .angular-logo {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .angular-logo svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 2px 4px rgba(221, 0, 49, 0.2));
      transition: transform 0.3s ease;
    }

    .powered-by:hover .angular-logo svg {
      transform: rotate(5deg) scale(1.1);
    }

    .angular-text {
      font-size: 1.125rem;
      font-weight: 600;
      background: linear-gradient(135deg, #dd0031 0%, #c3002f 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
    }

    .version {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 500;
      padding: 0.125rem 0.375rem;
      background: rgba(221, 0, 49, 0.1);
      border-radius: 0.25rem;
      margin-left: -0.25rem;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.8;
      }
    }

    @media (max-width: 768px) {
      .powered-by {
        padding: 0.625rem 1rem;
        gap: 0.625rem;
      }

      .angular-logo {
        width: 24px;
        height: 24px;
      }

      .angular-text {
        font-size: 1rem;
      }

      .powered-text {
        font-size: 0.8125rem;
      }
    }

    :host-context(.dark-mode) .powered-by {
      background: linear-gradient(135deg, rgba(221, 0, 49, 0.08) 0%, rgba(195, 0, 47, 0.08) 100%);
      border-color: rgba(221, 0, 49, 0.3);
    }

    :host-context(.dark-mode) .powered-by:hover {
      background: linear-gradient(135deg, rgba(221, 0, 49, 0.12) 0%, rgba(195, 0, 47, 0.12) 100%);
      border-color: rgba(221, 0, 49, 0.4);
    }

    :host-context(.dark-mode) .version {
      background: rgba(221, 0, 49, 0.15);
    }
  `]
})
export class PoweredByComponent {}