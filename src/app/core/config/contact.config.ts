/**
 * Contact configuration
 * Centralized contact information used across the application
 */
export const CONTACT_CONFIG = {
  email: 'guziczak@pm.me',
  phone: '+48693069832',
  phoneDisplay: '+48 693 069 832',
  github: 'https://github.com/guziczak',
  githubUsername: 'guziczak',
  linkedin: 'https://linkedin.com/in/guziczak',
  linkedinUsername: 'guziczak',
} as const;

export type ContactConfig = typeof CONTACT_CONFIG;
