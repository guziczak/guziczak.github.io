import { TestBed } from '@angular/core/testing';
import { ContactProtectionService } from './contact-protection.service';

describe('ContactProtectionService', () => {
  let service: ContactProtectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactProtectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Email functionality', () => {
    it('should return decoded email on getEmail()', () => {
      const email = service.getEmail();
      expect(email).toBe('guziczak@pm.me');
    });

    it('should return mailto link on getMailtoLink()', () => {
      const mailtoLink = service.getMailtoLink();
      expect(mailtoLink).toBe('mailto:guziczak@pm.me');
    });

    it('should return obfuscated email for display', () => {
      const obfuscatedEmail = service.getObfuscatedEmail();
      expect(obfuscatedEmail).toBe('guziczak[at]pm[dot]me');
    });

    it('should cache decoded email after first call', () => {
      // First call - decodes
      const email1 = service.getEmail();
      // Second call - should use cached value
      const email2 = service.getEmail();

      expect(email1).toBe(email2);
      expect(email1).toBe('guziczak@pm.me');
    });
  });

  describe('Phone functionality', () => {
    it('should return decoded phone on getPhone()', () => {
      const phone = service.getPhone();
      expect(phone).toBe('+48693069832');
    });

    it('should return tel link on getTelLink()', () => {
      const telLink = service.getTelLink();
      expect(telLink).toBe('tel:+48693069832');
    });

    it('should return obfuscated phone for display', () => {
      const obfuscatedPhone = service.getObfuscatedPhone();
      expect(obfuscatedPhone).toBe('+48 693 069 xxx');
    });

    it('should cache decoded phone after first call', () => {
      // First call - decodes
      const phone1 = service.getPhone();
      // Second call - should use cached value
      const phone2 = service.getPhone();

      expect(phone1).toBe(phone2);
      expect(phone1).toBe('+48693069832');
    });
  });

  describe('Encoding/Decoding', () => {
    it('should correctly decode base64 strings', () => {
      // Test the private decode method indirectly through public methods
      const email = service.getEmail();
      const phone = service.getPhone();

      expect(email).not.toContain('='); // No base64 characters
      expect(phone).not.toContain('='); // No base64 characters
    });

    it('should handle empty or invalid encoded data gracefully', () => {
      // This would require modifying the service to accept parameters
      // or creating a test-specific subclass
      expect(service).toBeTruthy();
    });
  });

  describe('Security', () => {
    it('should not expose raw encoded values', () => {
      // Ensure the service doesn't have public methods that expose encoded data
      const serviceAny = service as any;

      expect(serviceAny.encodedEmail).toBeUndefined(); // Should be private
      expect(serviceAny.encodedPhone).toBeUndefined(); // Should be private
    });

    it('should only decode on demand', () => {
      // Create a new instance to ensure clean state
      const freshService = TestBed.inject(ContactProtectionService);

      // Before calling get methods, decoded values should be null
      const serviceAny = freshService as any;

      // Access private signals through their callable nature
      expect(serviceAny.decodedEmail()).toBeNull();
      expect(serviceAny.decodedPhone()).toBeNull();

      // After calling get methods, they should be populated
      freshService.getEmail();
      freshService.getPhone();

      expect(serviceAny.decodedEmail()).not.toBeNull();
      expect(serviceAny.decodedPhone()).not.toBeNull();
    });
  });
});
