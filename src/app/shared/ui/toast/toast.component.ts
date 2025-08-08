import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (
        notification of notificationService.activeNotifications();
        track notification.id
      ) {
        <div
          class="toast"
          [class]="'toast-' + notification.type"
          [@slideIn]
          role="alert"
        >
          <div class="toast-icon">
            @switch (notification.type) {
              @case ('success') {
                <i class="fas fa-check-circle"></i>
              }
              @case ('error') {
                <i class="fas fa-exclamation-circle"></i>
              }
              @case ('warning') {
                <i class="fas fa-exclamation-triangle"></i>
              }
              @case ('info') {
                <i class="fas fa-info-circle"></i>
              }
            }
          </div>

          <div class="toast-content">
            <p class="toast-message">{{ notification.message }}</p>
            @if (notification.action) {
              <button
                class="toast-action"
                (click)="notification.action!.handler()"
              >
                {{ notification.action.label }}
              </button>
            }
          </div>

          <button
            class="toast-close"
            (click)="notificationService.dismiss(notification.id)"
            aria-label="Close notification"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 500px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: all;
        border-left: 4px solid;
      }

      .toast-success {
        border-left-color: #10b981;
      }

      .toast-success .toast-icon {
        color: #10b981;
      }

      .toast-error {
        border-left-color: #ef4444;
      }

      .toast-error .toast-icon {
        color: #ef4444;
      }

      .toast-warning {
        border-left-color: #f59e0b;
      }

      .toast-warning .toast-icon {
        color: #f59e0b;
      }

      .toast-info {
        border-left-color: #3b82f6;
      }

      .toast-info .toast-icon {
        color: #3b82f6;
      }

      .toast-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .toast-content {
        flex: 1;
      }

      .toast-message {
        margin: 0;
        color: var(--text-primary);
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .toast-action {
        margin-top: 8px;
        padding: 4px 12px;
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        border-radius: 4px;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .toast-action:hover {
        background: var(--color-primary);
        color: white;
      }

      .toast-close {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .toast-close:hover {
        background: rgba(0, 0, 0, 0.1);
        color: var(--text-primary);
      }

      @media (max-width: 640px) {
        .toast-container {
          left: 10px;
          right: 10px;
        }

        .toast {
          min-width: auto;
          max-width: none;
        }
      }
    `,
  ],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate(
          '300ms ease-out',
          style({ transform: 'translateX(0)', opacity: 1 }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ transform: 'translateX(100%)', opacity: 0 }),
        ),
      ]),
    ]),
  ],
})
export class ToastComponent {
  notificationService = inject(NotificationService);
}
