import { Injectable, signal, computed } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);

  public readonly activeNotifications = this.notifications.asReadonly();
  public readonly hasNotifications = computed(
    () => this.notifications().length > 0,
  );

  private defaultDuration = 5000;

  show(notification: Omit<Notification, 'id'>): string {
    const id = this.generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? this.defaultDuration,
    };

    this.notifications.update((current) => [...current, newNotification]);

    // Auto-dismiss after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, newNotification.duration);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show({ type: 'success', message, duration });
  }

  error(message: string, duration?: number): string {
    return this.show({ type: 'error', message, duration: duration ?? 8000 });
  }

  warning(message: string, duration?: number): string {
    return this.show({ type: 'warning', message, duration });
  }

  info(message: string, duration?: number): string {
    return this.show({ type: 'info', message, duration });
  }

  dismiss(id: string): void {
    this.notifications.update((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }

  dismissAll(): void {
    this.notifications.set([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
