import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface ContactInfo {
  email: string;
  phone: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly contactRevealed = signal(false);
  private readonly sessionKey = 'contact_revealed';
  
  constructor() {
    this.checkSessionState();
  }

  private checkSessionState(): void {
    const revealed = sessionStorage.getItem(this.sessionKey);
    if (revealed === 'true') {
      this.contactRevealed.set(true);
    }
  }

  getContactInfo(): ContactInfo | null {
    if (!this.isHuman()) {
      return null;
    }

    this.revealContact();
    
    return {
      email: this.decodeInfo(environment.contactEmailEncoded),
      phone: this.decodeInfo(environment.contactPhoneEncoded),
    };
  }

  getObfuscatedEmail(): string {
    const email = this.decodeInfo(environment.contactEmailEncoded);
    return this.obfuscateEmail(email);
  }

  getObfuscatedPhone(): string {
    const phone = this.decodeInfo(environment.contactPhoneEncoded);
    return this.obfuscatePhone(phone);
  }

  async getProtectedEmail(): Promise<string> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const email = this.decodeInfo(environment.contactEmailEncoded);
        resolve(email);
      });
    });
  }

  async getProtectedPhone(): Promise<string> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const phone = this.decodeInfo(environment.contactPhoneEncoded);
        resolve(phone);
      });
    });
  }

  createMailtoLink(subject?: string, body?: string): string {
    const email = this.decodeInfo(environment.contactEmailEncoded);
    let mailto = `mailto:${email}`;
    
    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    
    if (params.length > 0) {
      mailto += `?${params.join('&')}`;
    }
    
    return mailto;
  }

  createTelLink(): string {
    const phone = this.decodeInfo(environment.contactPhoneEncoded);
    return `tel:${phone.replace(/\s/g, '')}`;
  }

  copyToClipboard(type: 'email' | 'phone'): Promise<boolean> {
    const text = type === 'email' 
      ? this.decodeInfo(environment.contactEmailEncoded)
      : this.decodeInfo(environment.contactPhoneEncoded);
    
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  private isHuman(): boolean {
    // Simple bot detection
    const hasInteracted = this.contactRevealed();
    const hasJavaScript = true;
    const hasValidUserAgent = !navigator.userAgent.toLowerCase().includes('bot');
    const hasScreenSize = window.screen.width > 0 && window.screen.height > 0;
    
    return hasJavaScript && hasValidUserAgent && hasScreenSize;
  }

  private revealContact(): void {
    if (!this.contactRevealed()) {
      this.contactRevealed.set(true);
      sessionStorage.setItem(this.sessionKey, 'true');
    }
  }

  private decodeInfo(encoded: string): string {
    try {
      return atob(encoded);
    } catch {
      return '';
    }
  }

  private obfuscateEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***.***';
    
    const obfuscatedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '*'.repeat(local.length);
    
    const [domainName, tld] = domain.split('.');
    const obfuscatedDomain = domainName.length > 2
      ? domainName[0] + '*'.repeat(domainName.length - 2) + domainName[domainName.length - 1]
      : '*'.repeat(domainName.length);
    
    return `${obfuscatedLocal}@${obfuscatedDomain}.${tld}`;
  }

  private obfuscatePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return '*'.repeat(digits.length);
    
    return `+${digits.slice(0, 2)} *** *** ${digits.slice(-3)}`;
  }
}