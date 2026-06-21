import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationService } from '../../core/services/animation.service';
import { HeroSectionComponent } from '../../features/home/hero-section.component';
import { ProjectsSectionComponent } from '../../features/projects/projects-section.component';
import { NumbersSectionComponent } from '../../features/numbers/numbers-section.component';
import { ContactSectionComponent } from '../../features/contact/contact-section.component';
import { ScrollProgressComponent } from '../../shared/ui/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from '../../shared/ui/back-to-top/back-to-top.component';

/**
 * The cathedral — one descent: manifesto → proof → numbers → quiet exit.
 * The performer sections (about, skills, games, certificates, achievements,
 * testimonials) are gone. Mniej rzeczy, każda cięższa.
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    ProjectsSectionComponent,
    NumbersSectionComponent,
    ContactSectionComponent,
    ScrollProgressComponent,
    BackToTopComponent,
  ],
  template: `
    <app-scroll-progress />

    <main class="main-content">
      <app-hero-section id="home" />
      <app-projects-section id="projects" />
      <app-numbers-section id="numbers" />
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
    // Reveal .animate-on-scroll elements once the view is ready.
    setTimeout(() => {
      this.animationService.reinitializeAnimations();
    }, 500);
  }
}
