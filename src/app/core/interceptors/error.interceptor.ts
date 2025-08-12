import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        switch (error.status) {
          case 400:
            errorMessage = 'Bad request. Please check your input.';
            break;
          case 401:
            errorMessage = 'Unauthorized. Please log in.';
            // Redirect to login page
            router.navigate(['/login'], { 
              queryParams: { returnUrl: router.url } 
            });
            break;
          case 403:
            errorMessage = "Forbidden. You don't have permission.";
            break;
          case 404:
            errorMessage = 'Resource not found.';
            break;
          case 500:
            errorMessage = 'Internal server error. Please try again later.';
            break;
          case 503:
            errorMessage = 'Service unavailable. Please try again later.';
            break;
          default:
            errorMessage = `Error ${error.status}: ${error.message}`;
        }
      }

      // Log error to console in development
      if (isDevMode()) {
        console.error('HTTP Error:', error);
      }

      // Show notification
      notificationService.error(errorMessage);

      // Track error for analytics (if implemented)
      // analyticsService.trackError(error);

      return throwError(() => error);
    }),
  );
};
