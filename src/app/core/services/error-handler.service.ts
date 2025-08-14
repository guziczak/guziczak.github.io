import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

export interface ErrorContext {
  component?: string;
  method?: string;
  user?: string;
  timestamp?: string;
  url?: string;
  stack?: string;
  data?: any;
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: ErrorContext,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApplicationError';
    Object.setPrototypeOf(this, ApplicationError.prototype);
  }
}

@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);
  private notification = inject(NotificationService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  
  private readonly errorMessages = new Map<string, string>([
    ['NETWORK_ERROR', 'Network connection issue. Please check your internet connection.'],
    ['PERMISSION_DENIED', 'You do not have permission to perform this action.'],
    ['NOT_FOUND', 'The requested resource was not found.'],
    ['VALIDATION_ERROR', 'Please check your input and try again.'],
    ['SERVER_ERROR', 'An unexpected error occurred. Please try again later.'],
    ['TIMEOUT', 'The request took too long. Please try again.'],
    ['UNAUTHORIZED', 'Please log in to continue.'],
    ['FORBIDDEN', 'Access denied.'],
    ['CONFLICT', 'The action conflicts with the current state.'],
    ['RATE_LIMIT', 'Too many requests. Please slow down.'],
  ]);

  handleError(error: Error | ApplicationError): void {
    this.ngZone.run(() => {
      const errorInfo = this.extractErrorInfo(error);
      
      this.logger.error('Global error handler:', errorInfo);
      
      if (this.isUserFacingError(error)) {
        this.showUserNotification(errorInfo);
      }
      
      if (this.isCriticalError(error)) {
        this.handleCriticalError(errorInfo);
      }
      
      this.reportError(errorInfo);
    });
  }

  private extractErrorInfo(error: any): ErrorContext {
    const timestamp = new Date().toISOString();
    const url = this.router.url;
    
    if (error instanceof ApplicationError) {
      return {
        ...error.context,
        timestamp,
        url,
        stack: error.stack,
      };
    }
    
    if (error instanceof Error) {
      return {
        timestamp,
        url,
        stack: error.stack,
        data: {
          message: error.message,
          name: error.name,
        },
      };
    }
    
    return {
      timestamp,
      url,
      data: error,
    };
  }

  private isUserFacingError(error: any): boolean {
    if (error instanceof ApplicationError) {
      return true;
    }
    
    if (error?.status && error.status >= 400 && error.status < 500) {
      return true;
    }
    
    return false;
  }

  private isCriticalError(error: any): boolean {
    if (error instanceof ApplicationError && error.code === 'CRITICAL') {
      return true;
    }
    
    if (error?.status && error.status >= 500) {
      return true;
    }
    
    if (error?.name === 'SecurityError') {
      return true;
    }
    
    return false;
  }

  private showUserNotification(errorInfo: ErrorContext): void {
    const message = this.getUserFriendlyMessage(errorInfo);
    this.notification.error(message);
  }

  private getUserFriendlyMessage(errorInfo: ErrorContext): string {
    if (errorInfo.data?.code) {
      const message = this.errorMessages.get(errorInfo.data.code);
      if (message) return message;
    }
    
    if (errorInfo.data?.status) {
      switch (errorInfo.data.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Please log in to continue.';
        case 403:
          return 'You do not have permission to access this resource.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'This action conflicts with the current state.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Please try again later.';
        case 502:
          return 'Service temporarily unavailable. Please try again.';
        case 503:
          return 'Service is currently under maintenance.';
        default:
          return 'An unexpected error occurred. Please try again.';
      }
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  private handleCriticalError(errorInfo: ErrorContext): void {
    this.logger.error('CRITICAL ERROR DETECTED', errorInfo);
    
    // In production, you might want to:
    // - Send immediate alert to monitoring service
    // - Log to external service
    // - Show maintenance page
    // - Redirect to error page
    
    if (errorInfo.data?.code === 'SECURITY_BREACH') {
      this.router.navigate(['/maintenance']);
    }
  }

  private reportError(errorInfo: ErrorContext): void {
    // In production, send to error tracking service
    // Examples: Sentry, LogRocket, Rollbar, etc.
    
    try {
      // Example Sentry integration:
      // if (typeof Sentry !== 'undefined') {
      //   Sentry.captureException(errorInfo.data || errorInfo, {
      //     contexts: {
      //       app: {
      //         component: errorInfo.component,
      //         method: errorInfo.method,
      //         url: errorInfo.url,
      //       },
      //     },
      //   });
      // }
      
      // Example custom error reporting:
      // this.http.post('/api/errors', errorInfo).subscribe();
      
      this.logger.debug('Error reported:', errorInfo);
    } catch (reportingError) {
      this.logger.error('Failed to report error:', reportingError);
    }
  }

  createError(
    message: string,
    code?: string,
    context?: ErrorContext
  ): ApplicationError {
    return new ApplicationError(message, code, context);
  }

  wrapError(
    error: any,
    message: string,
    context?: ErrorContext
  ): ApplicationError {
    return new ApplicationError(message, undefined, context, error);
  }
}