import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <section id="contact" class="contact-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">
            {{ t('contact.title') || 'Contact Me' }}
          </h2>
          <p class="section-subtitle">
            {{ t('contact.subtitle') || 'Let\'s discuss your next project' }}
          </p>
        </div>

        <div class="contact-container">
          <!-- Contact Info -->
          <div class="contact-info animate-on-scroll">
            <h3 class="contact-info-title">{{ t('contact.getInTouch') || 'Get In Touch' }}</h3>
            
            <div class="contact-detail">
              <div class="contact-icon">
                <i class="fas fa-map-marker-alt"></i>
              </div>
              <div class="contact-text">
                {{ t('contact.location') || 'Wrocław, Poland' }}
              </div>
            </div>

            <div class="contact-detail">
              <div class="contact-icon">
                <i class="fas fa-envelope"></i>
              </div>
              <div class="contact-text">
                <a href="mailto:guziczak@pm.me">guziczak&#64;pm.me</a>
              </div>
            </div>

            <div class="contact-detail">
              <div class="contact-icon">
                <i class="fas fa-phone-alt"></i>
              </div>
              <div class="contact-text">
                <a href="tel:+48693069832">+48 693 069 832</a>
              </div>
            </div>

            <div class="contact-detail">
              <div class="contact-icon">
                <i class="fab fa-github"></i>
              </div>
              <div class="contact-text">
                <a href="https://github.com/guziczak" target="_blank" rel="noopener">
                  github.com/guziczak
                </a>
              </div>
            </div>

            <div class="contact-detail">
              <div class="contact-icon">
                <i class="fab fa-linkedin-in"></i>
              </div>
              <div class="contact-text">
                <a href="https://linkedin.com/in/guziczak" target="_blank" rel="noopener">
                  linkedin.com/in/guziczak
                </a>
              </div>
            </div>

            <div class="contact-action">
              <button class="btn btn-primary" (click)="toggleModal()">
                <i class="fas fa-paper-plane"></i>
                <span>{{ t('contact.sendMessage') || 'Send Me a Message' }}</span>
              </button>
            </div>
          </div>

          <!-- Contact Card -->
          <div class="contact-visual animate-on-scroll" style="animation-delay: 0.2s;">
            <div class="contact-card">
              <div class="contact-card-header">
                <i class="fas fa-comment-dots"></i>
                <h4>{{ t('contact.letsConnect') || 'Let\'s Connect' }}</h4>
              </div>
              <div class="contact-card-body">
                <p>
                  {{ t('contact.cardText') || 
                    'Feel free to reach out for job opportunities, collaborations, or just to say hello. I\'m always interested in new projects and challenges!' 
                  }}
                </p>
                <button class="btn btn-primary" (click)="toggleModal()">
                  <i class="fas fa-paper-plane"></i>
                  <span>{{ t('contact.sendMessage') || 'Send Message' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Modal -->
      @if (isModalOpen()) {
        <div class="modal-overlay" (click)="closeModal()"></div>
        <div class="modal" role="dialog" aria-labelledby="modalTitle" aria-modal="true">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modalTitle">{{ t('contact.modalTitle') || 'Contact Me' }}</h3>
              <button class="modal-close" (click)="closeModal()" aria-label="Close modal">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              @if (!isSuccess()) {
                <form [formGroup]="contactForm" (ngSubmit)="sendMessage()">
                  <div class="form-group">
                    <input 
                      type="text" 
                      class="form-control" 
                      formControlName="name"
                      placeholder=" "
                      [class.error]="contactForm.get('name')?.invalid && contactForm.get('name')?.touched"
                    >
                    <label class="form-label">{{ t('contact.yourName') || 'Your Name' }}</label>
                    @if (contactForm.get('name')?.invalid && contactForm.get('name')?.touched) {
                      <div class="form-error">Name is required</div>
                    }
                  </div>

                  <div class="form-group">
                    <input 
                      type="email" 
                      class="form-control" 
                      formControlName="email"
                      placeholder=" "
                      [class.error]="contactForm.get('email')?.invalid && contactForm.get('email')?.touched"
                    >
                    <label class="form-label">{{ t('contact.yourEmail') || 'Your Email' }}</label>
                    @if (contactForm.get('email')?.invalid && contactForm.get('email')?.touched) {
                      <div class="form-error">Valid email is required</div>
                    }
                  </div>

                  <div class="form-group">
                    <input 
                      type="text" 
                      class="form-control" 
                      formControlName="subject"
                      placeholder=" "
                      [class.error]="contactForm.get('subject')?.invalid && contactForm.get('subject')?.touched"
                    >
                    <label class="form-label">{{ t('contact.subject') || 'Subject' }}</label>
                    @if (contactForm.get('subject')?.invalid && contactForm.get('subject')?.touched) {
                      <div class="form-error">Subject is required</div>
                    }
                  </div>

                  <div class="form-group">
                    <textarea 
                      class="form-control" 
                      formControlName="message"
                      placeholder=" "
                      rows="5"
                      [class.error]="contactForm.get('message')?.invalid && contactForm.get('message')?.touched"
                    ></textarea>
                    <label class="form-label">{{ t('contact.yourMessage') || 'Your Message' }}</label>
                    @if (contactForm.get('message')?.invalid && contactForm.get('message')?.touched) {
                      <div class="form-error">Message is required</div>
                    }
                  </div>

                  <button 
                    type="submit" 
                    class="btn btn-primary"
                    [disabled]="contactForm.invalid || isSending()"
                  >
                    @if (isSending()) {
                      <span class="spinner"></span>
                    }
                    <i class="fas fa-paper-plane"></i>
                    <span>{{ t('contact.send') || 'Send Message' }}</span>
                  </button>
                </form>
              } @else {
                <div class="modal-success">
                  <div class="modal-success-icon">
                    <i class="fas fa-check-circle"></i>
                  </div>
                  <h3>{{ t('contact.successTitle') || 'Message Sent!' }}</h3>
                  <p>{{ t('contact.successMessage') || 'Thank you for reaching out. I\'ll get back to you soon.' }}</p>
                  <button class="btn btn-primary" (click)="closeModal()">
                    {{ t('contact.done') || 'Done' }}
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .contact-section {
      padding: 5rem 0;
      background: var(--bg-primary);
    }

    .section-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .section-title {
      font-size: clamp(2rem, 4vw, 3rem);
      margin-bottom: 1rem;
      color: var(--color-primary);
      font-weight: 700;
    }

    .section-subtitle {
      font-size: 1.125rem;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto;
    }

    .contact-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    .contact-info-title {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      color: var(--text-primary);
    }

    .contact-detail {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .contact-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .contact-text {
      font-size: 1rem;
      color: var(--text-primary);
    }

    .contact-text a {
      color: var(--text-primary);
      text-decoration: none;
      transition: color 0.3s;
    }

    .contact-text a:hover {
      color: var(--color-primary);
    }

    .contact-action {
      margin-top: 2rem;
    }

    .contact-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 2rem;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      transition: transform 0.3s;
    }

    .contact-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }

    .contact-card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      color: var(--color-primary);
    }

    .contact-card-header i {
      font-size: 2rem;
    }

    .contact-card-header h4 {
      font-size: 1.25rem;
      margin: 0;
    }

    .contact-card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .contact-card-body p {
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.75rem;
      min-height: 48px;
      border-radius: 50px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-dark);
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 112, 243, 0.3);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      animation: fadeIn 0.3s;
    }

    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      animation: slideUp 0.3s;
    }

    .modal-content {
      background: var(--bg-primary);
      border-radius: 12px;
      width: min(500px, 90vw);
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      color: var(--text-primary);
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.3s;
    }

    .modal-close:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .modal-body {
      padding: 2rem;
    }

    .form-group {
      position: relative;
      margin-bottom: 1.5rem;
    }

    .form-control {
      width: 100%;
      padding: 1rem;
      border: 2px solid var(--border-color);
      border-radius: 8px;
      font-size: 1rem;
      background: var(--bg-primary);
      color: var(--text-primary);
      transition: all 0.3s;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .form-control.error {
      border-color: var(--color-error);
    }

    .form-label {
      position: absolute;
      left: 1rem;
      top: 1rem;
      color: var(--text-secondary);
      transition: all 0.3s;
      pointer-events: none;
      background: var(--bg-primary);
      padding: 0 0.25rem;
    }

    .form-control:focus + .form-label,
    .form-control:not(:placeholder-shown) + .form-label {
      top: -0.5rem;
      left: 0.75rem;
      font-size: 0.875rem;
      color: var(--color-primary);
    }

    .form-error {
      color: var(--color-error);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    textarea.form-control {
      resize: vertical;
      min-height: 120px;
    }

    .modal-success {
      text-align: center;
      padding: 2rem;
    }

    .modal-success-icon {
      font-size: 4rem;
      color: var(--color-success);
      margin-bottom: 1rem;
    }

    .modal-success h3 {
      color: var(--text-primary);
      margin-bottom: 1rem;
    }

    .modal-success p {
      color: var(--text-secondary);
      margin-bottom: 2rem;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translate(-50%, -40%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .contact-container {
        grid-template-columns: 1fr;
        gap: 3rem;
      }

      .contact-section {
        padding: 3rem 0;
      }
    }
  `],
})
export class ContactSectionComponent {
  private languageService = inject(LanguageService);
  private fb = inject(FormBuilder);

  isModalOpen = signal(false);
  isSending = signal(false);
  isSuccess = signal(false);

  contactForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', Validators.required],
    message: ['', Validators.required]
  });

  t(key: string): string {
    return this.languageService.t(key);
  }

  toggleModal() {
    this.isModalOpen.set(!this.isModalOpen());
    if (this.isModalOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      this.resetForm();
    }
  }

  closeModal() {
    this.isModalOpen.set(false);
    document.body.style.overflow = '';
    this.resetForm();
  }

  sendMessage() {
    if (this.contactForm.valid) {
      this.isSending.set(true);
      
      // Simulate sending message
      setTimeout(() => {
        this.isSending.set(false);
        this.isSuccess.set(true);
        
        // Log form data (in real app, send to backend)
        console.log('Contact form submitted:', this.contactForm.value);
        
        // Reset after showing success
        setTimeout(() => {
          this.closeModal();
        }, 3000);
      }, 1500);
    }
  }

  private resetForm() {
    this.contactForm.reset();
    this.isSuccess.set(false);
    this.isSending.set(false);
  }
}