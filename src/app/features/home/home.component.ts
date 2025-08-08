import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';
import { ContactProtectionService } from '../../core/services/contact-protection.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="hero">
      <!-- Animated background particles -->
      <div class="hero-particles">
        @for (particle of particles(); track $index) {
          <div
            class="particle"
            [style.width.px]="particle.size"
            [style.height.px]="particle.size"
            [style.left.%]="particle.x"
            [style.top.%]="particle.y"
            [style.animation-delay.s]="particle.delay"
          ></div>
        }
      </div>

      <div class="container">
        <div class="hero-content">
          <div class="hero-text animate-on-scroll">
            <h1 class="hero-title">{{ t('hero.title') }}</h1>
            <h2 class="hero-subtitle text-gradient">
              {{ t('hero.subtitle') }}
            </h2>
            <p class="hero-description">{{ t('hero.description') }}</p>

            <div class="hero-cta">
              <a routerLink="/contact" class="btn btn-primary">
                <i class="fas fa-paper-plane"></i>
                <span>{{ t('hero.cta.contact') }}</span>
              </a>
              <a routerLink="/projects" class="btn btn-secondary">
                <i class="fas fa-code"></i>
                <span>{{ t('hero.cta.projects') }}</span>
              </a>
              <a href="/cv" target="_blank" class="btn btn-accent">
                <i class="fas fa-file-alt"></i>
                <span>{{ t('hero.cta.cv') }}</span>
              </a>
            </div>

            <div class="social-links">
              <a
                href="https://github.com/guziczak"
                target="_blank"
                class="social-btn"
                aria-label="GitHub"
              >
                <i class="fab fa-github"></i>
              </a>
              <a
                href="https://linkedin.com/in/guziczak"
                target="_blank"
                class="social-btn"
                aria-label="LinkedIn"
              >
                <i class="fab fa-linkedin-in"></i>
              </a>
              <a
                [href]="emailLink()"
                (mouseenter)="loadEmail()"
                (click)="handleEmailClick($event)"
                class="social-btn"
                aria-label="Email"
                [title]="emailDisplay()"
              >
                <i class="fas fa-envelope"></i>
              </a>
              <a
                [href]="phoneLink()"
                (mouseenter)="loadPhone()"
                (click)="handlePhoneClick($event)"
                class="social-btn"
                aria-label="Phone"
                [title]="phoneDisplay()"
              >
                <i class="fas fa-phone-alt"></i>
              </a>
            </div>
          </div>

          <div
            class="hero-image animate-on-scroll"
            style="animation-delay: 0.3s;"
          >
            <div class="profile-container">
              <div class="profile-bg"></div>
              <img
                src="assets/images/profile.jpg"
                alt="Łukasz Guziczak"
                class="profile-img"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .hero {
        min-height: 100vh;
        display: flex;
        align-items: center;
        padding: 5rem 0;
        position: relative;
        overflow: hidden;
        background: linear-gradient(
          135deg,
          var(--bg-primary) 0%,
          var(--bg-secondary) 100%
        );
      }

      .hero-particles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        z-index: 0;
      }

      .particle {
        position: absolute;
        background: var(--color-primary);
        border-radius: 50%;
        opacity: 0.1;
        animation: float 10s infinite ease-in-out;
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0) translateX(0);
        }
        25% {
          transform: translateY(-20px) translateX(10px);
        }
        50% {
          transform: translateY(10px) translateX(-10px);
        }
        75% {
          transform: translateY(-10px) translateX(10px);
        }
      }

      .hero-content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
        align-items: center;
        position: relative;
        z-index: 1;
      }

      .hero-title {
        font-size: clamp(2rem, 5vw, 3rem);
        margin-bottom: 1rem;
      }

      .hero-subtitle {
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        margin-bottom: 1.5rem;
      }

      .hero-description {
        font-size: 1.125rem;
        line-height: 1.8;
        color: var(--text-secondary);
        margin-bottom: 2rem;
      }

      .hero-cta {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 2rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-md);
        font-weight: 500;
        text-decoration: none;
        transition: all var(--transition-base) ease;
        cursor: pointer;
        border: 2px solid transparent;
      }

      .btn i {
        font-size: 1.125rem;
      }

      .btn-primary {
        background: var(--color-primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(var(--color-primary-rgb), 0.3);
      }

      .btn-secondary {
        background: transparent;
        color: var(--color-primary);
        border-color: var(--color-primary);
      }

      .btn-secondary:hover {
        background: var(--color-primary);
        color: white;
        transform: translateY(-2px);
      }

      .btn-accent {
        background: var(--color-accent);
        color: white;
      }

      .btn-accent:hover {
        background: var(--color-accent-dark);
        transform: translateY(-2px);
      }

      .social-links {
        display: flex;
        gap: 1rem;
      }

      .social-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: var(--radius-full);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        text-decoration: none;
        transition: all var(--transition-base) ease;
      }

      .social-btn:hover {
        background: var(--color-primary);
        color: white;
        transform: translateY(-3px);
      }

      .hero-image {
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .profile-container {
        position: relative;
        width: 100%;
        max-width: 400px;
      }

      .profile-bg {
        position: absolute;
        top: -20px;
        right: -20px;
        bottom: -20px;
        left: -20px;
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-secondary)
        );
        border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
        animation: morph 8s ease-in-out infinite;
        opacity: 0.2;
      }

      .profile-img {
        width: 100%;
        height: auto;
        border-radius: 20px;
        position: relative;
        z-index: 1;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      }

      @keyframes morph {
        0%,
        100% {
          border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
        }
        50% {
          border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%;
        }
      }

      @media (max-width: 768px) {
        .hero-content {
          grid-template-columns: 1fr;
          text-align: center;
        }

        .hero-cta {
          justify-content: center;
        }

        .social-links {
          justify-content: center;
        }

        .hero-image {
          order: -1;
          margin-bottom: 2rem;
        }

        .profile-container {
          max-width: 250px;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private languageService = inject(LanguageService);
  private contactProtection = inject(ContactProtectionService);

  // Contact data signals
  protected emailLink = signal('');
  protected phoneLink = signal('');
  protected emailDisplay = signal('');
  protected phoneDisplay = signal('');

  // Translation method
  protected t(key: string): string {
    return this.languageService.t(key);
  }

  // Particles for background animation
  particles = signal<{ size: number; x: number; y: number; delay: number }[]>(
    [],
  );

  ngOnInit() {
    // Initialize obfuscated contact display
    this.emailDisplay.set(this.contactProtection.getObfuscatedEmail());
    this.phoneDisplay.set(this.contactProtection.getObfuscatedPhone());
    this.emailLink.set('#');
    this.phoneLink.set('#');

    // Generate random particles
    const particleCount = 15;
    const particlesArray = Array.from({ length: particleCount }, (_, i) => ({
      size: Math.random() * 20 + 10,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    this.particles.set(particlesArray);
  }

  // Contact protection methods
  loadEmail(): void {
    if (this.emailLink() === '#') {
      this.emailLink.set(this.contactProtection.getMailtoLink());
      this.emailDisplay.set(this.contactProtection.getEmail());
    }
  }

  loadPhone(): void {
    if (this.phoneLink() === '#') {
      this.phoneLink.set(this.contactProtection.getTelLink());
      this.phoneDisplay.set(this.contactProtection.getPhone());
    }
  }

  handleEmailClick(event: Event): void {
    if (this.emailLink() === '#') {
      event.preventDefault();
      this.loadEmail();
      // Retry click after loading
      setTimeout(() => {
        const target = event.target as HTMLElement;
        target.click();
      }, 100);
    }
  }

  handlePhoneClick(event: Event): void {
    if (this.phoneLink() === '#') {
      event.preventDefault();
      this.loadPhone();
      // Retry click after loading
      setTimeout(() => {
        const target = event.target as HTMLElement;
        target.click();
      }, 100);
    }
  }
}
