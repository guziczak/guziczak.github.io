import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Testimonial } from '../../core/services/data.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-testimonials-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="testimonials" class="testimonials-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">
            {{ t('testimonials.title') || 'Recommendations' }}
          </h2>
          <p class="section-subtitle">
            {{ t('testimonials.subtitle') || 'What colleagues say about working with me' }}
          </p>
        </div>

        <div class="testimonials-container">
          @for (testimonial of testimonials(); track testimonial.id; let i = $index) {
            <div 
              class="testimonial-card animate-on-scroll"
              [style.animation-delay.s]="i * 0.1"
            >
              <div class="testimonial-author">
                <h3 class="testimonial-name">{{ testimonial.name }}</h3>
                <p class="testimonial-role">{{ testimonial.role }}</p>
              </div>
              <div class="testimonial-content">
                <div class="testimonial-quote-icon">
                  <i class="fas fa-quote-left"></i>
                </div>
                <p class="testimonial-text">
                  {{ testimonial.quote }}
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .testimonials-section {
      padding: 5rem 0;
      background: var(--bg-secondary);
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

    .testimonials-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .testimonial-card {
      background: var(--bg-primary);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .testimonial-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }

    .testimonial-author {
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .testimonial-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .testimonial-role {
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .testimonial-content {
      position: relative;
      flex: 1;
    }

    .testimonial-quote-icon {
      position: absolute;
      top: -10px;
      left: -10px;
      color: var(--color-primary);
      opacity: 0.2;
      font-size: 2.5rem;
    }

    .testimonial-text {
      font-size: 1rem;
      line-height: 1.6;
      color: var(--text-primary);
      font-style: italic;
      padding-left: 20px;
    }

    @media (max-width: 768px) {
      .testimonials-container {
        grid-template-columns: 1fr;
      }

      .testimonial-card {
        padding: 1.5rem;
      }
    }
  `],
})
export class TestimonialsSectionComponent implements OnInit {
  private dataService = inject(DataService);
  private languageService = inject(LanguageService);
  
  testimonials = signal<Testimonial[]>([]);

  ngOnInit() {
    this.loadTestimonials();
  }

  private loadTestimonials() {
    this.dataService.getTestimonials().subscribe((data) => {
      this.testimonials.set(data);
    });
  }

  t(key: string): string {
    return this.languageService.t(key);
  }
}