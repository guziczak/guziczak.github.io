import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ContactProtectionService {
  // Encoded contact data from environment
  private readonly encodedEmail = signal(environment.contactEmailEncoded);
  private readonly encodedPhone = signal(environment.contactPhoneEncoded);

  // Decoded contact data (only populated on user interaction)
  private decodedEmail = signal<string | null>(null);
  private decodedPhone = signal<string | null>(null);

  /**
   * Get email address (decoded on demand)
   */
  getEmail(): string {
    if (!this.decodedEmail()) {
      this.decodedEmail.set(this.decode(this.encodedEmail()));
    }
    return this.decodedEmail()!;
  }

  /**
   * Get phone number (decoded on demand)
   */
  getPhone(): string {
    if (!this.decodedPhone()) {
      this.decodedPhone.set(this.decode(this.encodedPhone()));
    }
    return this.decodedPhone()!;
  }

  /**
   * Get mailto link
   */
  getMailtoLink(): string {
    return `mailto:${this.getEmail()}`;
  }

  /**
   * Get tel link
   */
  getTelLink(): string {
    return `tel:${this.getPhone()}`;
  }

  /**
   * Get obfuscated email for display
   */
  getObfuscatedEmail(): string {
    return 'guziczak[at]pm[dot]me';
  }

  /**
   * Get obfuscated phone for display
   */
  getObfuscatedPhone(): string {
    return '+48 693 069 xxx';
  }

  /**
   * Decode base64 string
   */
  private decode(encoded: string): string {
    return atob(encoded);
  }

  /**
   * Encode string to base64 (for reference)
   */
  private encode(str: string): string {
    return btoa(str);
  }
}
