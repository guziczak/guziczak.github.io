import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';
import { ScrollService } from '../../core/services/scroll.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <section class="hero" id="home">
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

          <div class="hero-text animate-on-scroll">
            <h1 class="hero-title">{{ 'hero.title' | translate }}</h1>
            <h2 class="hero-subtitle">
              <span class="gradient-text-safe">{{ 'hero.subtitle' | translate }}</span>
            </h2>
            <p class="hero-description">{{ 'hero.description' | translate }}</p>

            <div class="hero-cta">
              <button (click)="scrollToContact()" class="btn btn-primary">
                <i class="fas fa-paper-plane"></i>
                <span>{{ 'hero.cta.contact' | translate }}</span>
              </button>
              <button (click)="scrollToProjects()" class="btn btn-secondary">
                <i class="fas fa-code"></i>
                <span>{{ 'hero.cta.projects' | translate }}</span>
              </button>
              <a href="/cv" target="_blank" class="btn btn-accent btn-floating">
                <i class="fas fa-file-alt"></i>
                <span>{{ 'hero.cta.cv' | translate }}</span>
              </a>
            </div>

            <div class="hero-social">
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
                href="mailto:guziczak@pm.me"
                class="social-btn"
                aria-label="Email"
              >
                <i class="fas fa-envelope"></i>
              </a>
              <a href="tel:+48693069832" class="social-btn" aria-label="Phone">
                <i class="fas fa-phone-alt"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./hero-section.component.scss'],
})
export class HeroSectionComponent implements OnInit {
  private languageService = inject(LanguageService);
  private scrollService = inject(ScrollService);

  // Translation method
  protected t(key: string): string {
    return this.languageService.t(key);
  }

  // Particles for background animation
  particles = signal<{ size: number; x: number; y: number; delay: number }[]>(
    [],
  );

  ngOnInit() {
    // Generate random particles - reduced for better performance
    const particleCount = 8;
    const particlesArray = Array.from({ length: particleCount }, (_, i) => ({
      size: Math.random() * 15 + 8,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    this.particles.set(particlesArray);
  }

  scrollToContact(): void {
    this.scrollService.scrollToSection('contact');
  }

  scrollToProjects(): void {
    this.scrollService.scrollToSection('projects');
  }
}
