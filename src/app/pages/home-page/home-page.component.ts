import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationService } from '../../core/services/animation.service';
import { HeroSectionComponent } from '../../features/home/hero-section.component';
import { AboutSectionComponent } from '../../features/about/about-section.component';
import { SkillsSectionComponent } from '../../features/skills/skills-section.component';
import { ProjectsSectionComponent } from '../../features/projects/projects-section.component';
import { GamesSectionComponent } from '../../features/games/games-section.component';
import { CertificatesSectionComponent } from '../../features/certificates/certificates-section.component';
import { AchievementsSectionComponent } from '../../features/achievements/achievements-section.component';
import { TestimonialsSectionComponent } from '../../features/testimonials/testimonials-section.component';
import { ContactSectionComponent } from '../../features/contact/contact-section.component';
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    AboutSectionComponent,
    SkillsSectionComponent,
    ProjectsSectionComponent,
    GamesSectionComponent,
    CertificatesSectionComponent,
    AchievementsSectionComponent,
    TestimonialsSectionComponent,
    ContactSectionComponent,
    ScrollProgressComponent,
    BackToTopComponent,
  ],
  template: `
    <app-scroll-progress />

    <main class="main-content">
      <app-hero-section id="home" />
      <app-about-section id="about" />
      <app-skills-section id="skills" />
      <app-projects-section id="projects" />
      <app-achievements-section id="achievements" />
      <app-games-section id="games" />
      <app-certificates-section id="certificates" />
      <app-testimonials-section id="testimonials" />
      <app-contact-section id="contact" />
    </main>

    <app-back-to-top />
  `,
  styles: [
    `
      .main-content {
        width: 100%;
        overflow-x: hidden;
      }
    `,
  ],
})
export class HomePageComponent implements OnInit {
  private animationService = inject(AnimationService);

  ngOnInit() {
    // Initialize scroll animations after view is ready
    setTimeout(() => {
      this.animationService.reinitializeAnimations();
    }, 500);
  }
}
