import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add success notification', () => {
    const message = 'Success message';
    const id = service.success(message);

    expect(id).toBeTruthy();
    expect(service.activeNotifications().length).toBe(1);
    expect(service.activeNotifications()[0].type).toBe('success');
    expect(service.activeNotifications()[0].message).toBe(message);
  });

  it('should add error notification with longer duration', () => {
    const message = 'Error message';
    const id = service.error(message);

    expect(id).toBeTruthy();
    expect(service.activeNotifications().length).toBe(1);
    expect(service.activeNotifications()[0].type).toBe('error');
    expect(service.activeNotifications()[0].duration).toBe(8000);
  });

  it('should add warning notification', () => {
    const message = 'Warning message';
    const id = service.warning(message);

    expect(id).toBeTruthy();
    expect(service.activeNotifications()[0].type).toBe('warning');
  });

  it('should add info notification', () => {
    const message = 'Info message';
    const id = service.info(message);

    expect(id).toBeTruthy();
    expect(service.activeNotifications()[0].type).toBe('info');
  });

  it('should dismiss specific notification', () => {
    const id1 = service.success('Message 1');
    const id2 = service.success('Message 2');

    expect(service.activeNotifications().length).toBe(2);

    service.dismiss(id1);

    expect(service.activeNotifications().length).toBe(1);
    expect(service.activeNotifications()[0].id).toBe(id2);
  });

  it('should dismiss all notifications', () => {
    service.success('Message 1');
    service.error('Message 2');
    service.warning('Message 3');

    expect(service.activeNotifications().length).toBe(3);

    service.dismissAll();

    expect(service.activeNotifications().length).toBe(0);
  });

  it('should auto-dismiss notification after duration', (done) => {
    const duration = 100; // 100ms for testing
    service.success('Auto dismiss', duration);

    expect(service.activeNotifications().length).toBe(1);

    setTimeout(() => {
      expect(service.activeNotifications().length).toBe(0);
      done();
    }, duration + 50);
  });

  it('should handle notification with action', () => {
    const actionHandler = jasmine.createSpy('actionHandler');
    const notification = {
      type: 'info' as const,
      message: 'Action notification',
      action: {
        label: 'Undo',
        handler: actionHandler,
      },
    };

    service.show(notification);

    const added = service.activeNotifications()[0];
    expect(added.action).toBeDefined();
    expect(added.action?.label).toBe('Undo');

    added.action?.handler();
    expect(actionHandler).toHaveBeenCalled();
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const id = service.success(`Message ${i}`);
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });
});
