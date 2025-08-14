import { Injectable, inject, isDevMode } from '@angular/core';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private readonly isDevelopment = isDevMode();
  private readonly logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
  private readonly enableRemoteLogging = false;
  
  error(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
      this.sendToRemote('error', message, args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  group(label: string): void {
    if (this.isDevelopment) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }

  time(label: string): void {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  table(data: any): void {
    if (this.isDevelopment) {
      console.table(data);
    }
  }

  private sendToRemote(level: string, message: string, args: any[]): void {
    if (!this.enableRemoteLogging || this.isDevelopment) {
      return;
    }

    try {
      const payload = {
        level,
        message,
        args: this.sanitizeArgs(args),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      
      // Implement remote logging here (e.g., Sentry, LogRocket, etc.)
      // Example: this.http.post('/api/logs', payload).subscribe();
    } catch (error) {
      // Fail silently to avoid infinite loops
    }
  }

  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      try {
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
          };
        }
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    });
  }
}