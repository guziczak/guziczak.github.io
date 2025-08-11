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
            {{
              t('testimonials.subtitle') ||
                'Professional endorsements and testimonials'
            }}
          </p>
        </div>

        <div class="testimonials-container">
          @for (
            testimonial of testimonials();
            track testimonial.id;
            let i = $index
          ) {
            <div
              class="testimonial-card animate-on-scroll"
              [style.animation-delay.s]="i * 0.1"
            >
              <div class="quote-icon">
                <i class="fas fa-quote-left"></i>
              </div>
              
              <blockquote class="testimonial-content">
                {{ testimonial.quote }}
              </blockquote>
              
              <div class="testimonial-author">
                <div class="author-info">
                  <div class="author-avatar">
                    @if (testimonial.linkedinUrl) {
                      <a 
                        [href]="testimonial.linkedinUrl" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="linkedin-link"
                        [attr.aria-label]="'View ' + testimonial.name + ' on LinkedIn'"
                      >
                        <i class="fab fa-linkedin"></i>
                      </a>
                    }
                    <div class="avatar-placeholder">
                      {{ getInitials(testimonial.name) }}
                    </div>
                  </div>
                  <div class="author-details">
                    <h3 class="author-name">{{ testimonial.name }}</h3>
                    <p class="author-role">{{ testimonial.role }}</p>
                    <p class="author-company">
                      @if (getCompanyLogo(testimonial.company)) {
                        <img 
                          [src]="getCompanyLogo(testimonial.company)" 
                          [alt]="testimonial.company"
                          class="company-logo"
                        >
                      } @else {
                        <span class="company-text">{{ testimonial.company }}</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div class="testimonial-rating">
                @for (star of [1,2,3,4,5]; track star) {
                  <i class="fas fa-star" [class.filled]="star <= testimonial.rating"></i>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .testimonials-section {
        padding: 5rem 0;
        background: var(--bg-secondary);
      }

      .section-header {
        text-align: center;
        margin-bottom: 4rem;
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
        grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
        gap: 2.5rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .testimonial-card {
        background: var(--bg-primary);
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border-color);
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .testimonial-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
        border-color: var(--color-primary-light);
      }

      .quote-icon {
        position: absolute;
        top: 20px;
        right: 25px;
        color: var(--color-primary);
        opacity: 0.1;
        font-size: 3rem;
        transform: rotate(180deg);
      }

      .testimonial-content {
        font-size: 1.05rem;
        line-height: 1.7;
        color: var(--text-primary);
        font-style: italic;
        margin: 0;
        padding: 0;
        flex: 1;
        position: relative;
        z-index: 1;
      }

      .testimonial-content::before {
        content: '';
        position: absolute;
        left: -15px;
        top: 0;
        bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
        border-radius: 2px;
        opacity: 0.3;
      }

      .testimonial-author {
        margin-top: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border-color);
      }

      .author-info {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .author-avatar {
        position: relative;
        width: 56px;
        height: 56px;
      }

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 1.125rem;
        color: white;
        text-transform: uppercase;
      }

      .linkedin-link {
        position: absolute;
        bottom: -4px;
        right: -4px;
        width: 24px;
        height: 24px;
        background: #0077B5;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 0.75rem;
        border: 2px solid var(--bg-primary);
        transition: transform 0.2s ease;
        z-index: 2;
      }

      .linkedin-link:hover {
        transform: scale(1.1);
        background: #005885;
      }

      .author-details {
        flex: 1;
      }

      .author-name {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.25rem 0;
      }

      .author-role {
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin: 0 0 0.25rem 0;
      }

      .author-company {
        margin: 0;
        display: flex;
        align-items: center;
        height: 24px;
      }

      .company-logo {
        height: 20px;
        width: auto;
        object-fit: contain;
        opacity: 0.8;
        filter: grayscale(100%);
        transition: all 0.3s ease;
      }

      .testimonial-card:hover .company-logo {
        opacity: 1;
        filter: grayscale(0%);
      }

      .company-text {
        font-size: 0.9rem;
        color: var(--color-primary);
        font-weight: 500;
      }

      .testimonial-rating {
        display: flex;
        gap: 0.25rem;
        margin-top: 0.5rem;
      }

      .testimonial-rating i {
        font-size: 0.875rem;
        color: var(--border-color);
      }

      .testimonial-rating i.filled {
        color: #fbbf24;
      }

      @media (max-width: 768px) {
        .testimonials-container {
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        .testimonial-card {
          padding: 2rem;
        }

        .quote-icon {
          font-size: 2.5rem;
        }

        .testimonial-content {
          font-size: 1rem;
        }
      }

      :host-context(.dark-mode) .testimonial-card {
        background: var(--bg-secondary);
      }

      :host-context(.dark-mode) .linkedin-link {
        border-color: var(--bg-secondary);
      }

      :host-context(.dark-mode) .company-logo {
        filter: grayscale(100%) brightness(0.8);
      }

      :host-context(.dark-mode) .testimonial-card:hover .company-logo {
        filter: grayscale(0%) brightness(1);
      }
    `,
  ],
})
export class TestimonialsSectionComponent implements OnInit {
  private dataService = inject(DataService);
  private languageService = inject(LanguageService);

  testimonials = signal<Testimonial[]>([]);

  // Company logos mapping
  private companyLogos: Record<string, string> = {
    'Asseco Solutions': 'assets/images/companies/asseco.png',
    'Luxoft': 'assets/images/companies/luxoft.png',
    'Philips Medical Systems': 'assets/images/companies/philips.png',
    'Streamsoft': 'assets/images/companies/streamsoft.png',
    'Right Information': ''
  };

  ngOnInit() {
    this.dataService.getTestimonials().subscribe((testimonials) => {
      this.testimonials.set(testimonials);
    });
  }

  protected t(key: string): string {
    return this.languageService.t(key);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  getCompanyLogo(company: string): string {
    return this.companyLogos[company] || '';
  }
}