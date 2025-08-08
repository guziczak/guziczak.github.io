import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DataService, Project } from '../../core/services/data.service';
import { LoadingService } from '../../core/services/loading.service';
import { NotificationService } from '../../core/services/notification.service';
import { AnimationEnhancedService } from '../../core/services/animation-enhanced.service';
import { BaseComponent } from '../../shared/base/base.component';
import { SkeletonLoaderComponent } from '../../shared/ui/skeleton-loader/skeleton-loader.component';
import { A11yDirective } from '../../shared/directives/a11y.directive';
import { VirtualScrollDirective } from '../../shared/directives/virtual-scroll.directive';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-projects-enhanced',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SkeletonLoaderComponent,
    A11yDirective,
    VirtualScrollDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="projects"
      class="projects-section"
      role="region"
      aria-label="Projects Section"
    >
      <div class="container">
        <!-- Header -->
        <header class="section-header">
          <h2 class="section-title">Featured Projects</h2>
          <p class="section-subtitle">Explore my latest work and innovations</p>
        </header>

        <!-- Filters and Search -->
        <div class="project-controls" role="search">
          <input
            type="search"
            [formControl]="searchControl"
            placeholder="Search projects..."
            class="search-input"
            aria-label="Search projects"
            [attr.aria-describedby]="
              searchResults() > 0 ? 'search-results' : null
            "
          />

          <div
            class="filter-chips"
            role="group"
            aria-label="Filter by technology"
          >
            @for (tag of availableTags(); track tag) {
              <button
                class="chip"
                [class.active]="selectedTags().includes(tag)"
                (click)="toggleTag(tag)"
                [attr.aria-pressed]="selectedTags().includes(tag)"
                appA11y
                [ariaLabel]="'Filter by ' + tag"
              >
                {{ tag }}
                @if (selectedTags().includes(tag)) {
                  <i class="fas fa-times-circle" aria-hidden="true"></i>
                }
              </button>
            }
          </div>

          @if (selectedTags().length > 0) {
            <button
              class="clear-filters"
              (click)="clearFilters()"
              appA11y
              ariaLabel="Clear all filters"
            >
              Clear Filters
            </button>
          }
        </div>

        <!-- Search Results Count -->
        @if (searchControl.value) {
          <div
            id="search-results"
            class="search-results"
            role="status"
            aria-live="polite"
          >
            Found {{ searchResults() }} project(s) matching "{{
              searchControl.value
            }}"
          </div>
        }

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="projects-grid">
            @for (item of [1, 2, 3, 4, 5, 6]; track item) {
              <app-skeleton-loader type="card"></app-skeleton-loader>
            }
          </div>
        }

        <!-- Error State -->
        @else if (error()) {
          <div class="error-state" role="alert">
            <i class="fas fa-exclamation-triangle"></i>
            <p>{{ error() }}</p>
            <button (click)="retry()" class="btn btn-primary">Try Again</button>
          </div>
        }

        <!-- Empty State -->
        @else if (filteredProjects().length === 0) {
          <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>No projects found matching your criteria</p>
            @if (searchControl.value || selectedTags().length > 0) {
              <button (click)="clearFilters()" class="btn btn-secondary">
                Clear Filters
              </button>
            }
          </div>
        }

        <!-- Projects Grid -->
        @else {
          <div
            class="projects-grid"
            appVirtualScroll
            [items]="filteredProjects()"
            [itemHeight]="350"
            (visibleItemsChange)="onVisibleItemsChange($event)"
          >
            @for (project of visibleProjects(); track project.id) {
              <article
                class="project-card"
                [@cardAnimation]
                tabindex="0"
                role="article"
                [attr.aria-label]="project.title"
                appA11y
                [ariaDescribedBy]="'project-desc-' + project.id"
              >
                <!-- Project Image -->
                <div class="project-image">
                  @if (project.imageSrc) {
                    <img
                      [attr.data-lazy-src]="project.imageSrc"
                      [alt]="project.title + ' preview'"
                      loading="lazy"
                    />
                  } @else {
                    <div class="image-placeholder">
                      <i class="fas fa-code"></i>
                    </div>
                  }

                  @if (project.featured) {
                    <span class="featured-badge" aria-label="Featured project">
                      <i class="fas fa-star"></i> Featured
                    </span>
                  }
                </div>

                <!-- Project Content -->
                <div class="project-content">
                  <h3 class="project-title">{{ project.title }}</h3>
                  <p
                    class="project-description"
                    [id]="'project-desc-' + project.id"
                  >
                    {{ project.description }}
                  </p>

                  <!-- Tags -->
                  <div
                    class="project-tags"
                    role="list"
                    aria-label="Technologies used"
                  >
                    @for (tag of project.tags.slice(0, 4); track tag) {
                      <span class="tag" role="listitem">{{ tag }}</span>
                    }
                    @if (project.tags.length > 4) {
                      <span class="tag more"
                        >+{{ project.tags.length - 4 }}</span
                      >
                    }
                  </div>

                  <!-- Actions -->
                  <div class="project-actions">
                    @if (project.projectLink) {
                      <a
                        [href]="project.projectLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-primary"
                        [attr.aria-label]="
                          'View ' + project.title + ' live demo'
                        "
                      >
                        <i
                          class="fas fa-external-link-alt"
                          aria-hidden="true"
                        ></i>
                        Live Demo
                      </a>
                    }
                    @if (project.codeLink) {
                      <a
                        [href]="project.codeLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-secondary"
                        [attr.aria-label]="
                          'View ' + project.title + ' source code'
                        "
                      >
                        <i class="fab fa-github" aria-hidden="true"></i>
                        Source Code
                      </a>
                    }
                  </div>
                </div>
              </article>
            }
          </div>

          <!-- Load More -->
          @if (hasMore()) {
            <div class="load-more">
              <button
                (click)="loadMore()"
                class="btn btn-outline"
                [disabled]="isLoadingMore()"
                aria-label="Load more projects"
              >
                @if (isLoadingMore()) {
                  <i class="fas fa-spinner fa-spin"></i>
                  Loading...
                } @else {
                  Load More Projects
                }
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      .projects-section {
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

      .project-controls {
        margin-bottom: 2rem;
      }

      .search-input {
        width: 100%;
        padding: 12px 20px;
        font-size: 1rem;
        background: var(--bg-secondary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        margin-bottom: 1rem;
        transition: all 0.3s ease;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
      }

      .filter-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 1rem;
      }

      .chip {
        padding: 6px 14px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .chip:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .chip.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
      }

      .project-card {
        background: var(--bg-secondary);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        cursor: pointer;
      }

      .project-card:hover,
      .project-card:focus-within {
        transform: translateY(-8px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
      }

      .project-card:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .project-image {
        position: relative;
        height: 200px;
        background: var(--bg-tertiary);
        overflow: hidden;
      }

      .project-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .project-card:hover .project-image img {
        transform: scale(1.05);
      }

      .image-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-secondary)
        );
        color: white;
        font-size: 3rem;
      }

      .featured-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 6px 12px;
        background: var(--color-warning);
        color: white;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .project-content {
        padding: 1.5rem;
      }

      .project-title {
        font-size: 1.25rem;
        margin-bottom: 0.75rem;
        color: var(--text-primary);
      }

      .project-description {
        color: var(--text-secondary);
        line-height: 1.6;
        margin-bottom: 1rem;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .project-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 1rem;
      }

      .tag {
        padding: 4px 10px;
        background: var(--bg-primary);
        border-radius: 4px;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      .tag.more {
        background: var(--color-primary);
        color: white;
      }

      .project-actions {
        display: flex;
        gap: 10px;
      }

      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.875rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
      }

      .btn-primary {
        background: var(--color-primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
      }

      .btn-secondary {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
      }

      .btn-secondary:hover {
        background: var(--color-primary);
        color: white;
      }

      .empty-state,
      .error-state {
        text-align: center;
        padding: 4rem 2rem;
      }

      .empty-state i,
      .error-state i {
        font-size: 4rem;
        color: var(--text-tertiary);
        margin-bottom: 1rem;
      }

      .error-state i {
        color: var(--color-error);
      }

      .search-results {
        margin-bottom: 1rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      .load-more {
        text-align: center;
        margin-top: 2rem;
      }

      .btn-outline {
        background: transparent;
        border: 2px solid var(--border-color);
        color: var(--text-primary);
        padding: 12px 24px;
      }

      .btn-outline:hover:not(:disabled) {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .btn-outline:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 768px) {
        .projects-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  animations: [
    trigger('cardAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate(
          '400ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
  ],
})
export class ProjectsEnhancedComponent extends BaseComponent implements OnInit {
  private dataService = inject(DataService);
  private loadingService = inject(LoadingService);
  private notificationService = inject(NotificationService);
  private animationService = inject(AnimationEnhancedService);

  // State management with signals
  projects = signal<Project[]>([]);
  visibleProjects = signal<Project[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  error = signal<string | null>(null);
  selectedTags = signal<string[]>([]);
  searchControl = new FormControl('');

  // Computed values
  availableTags = computed(() => {
    const tags = new Set<string>();
    this.projects().forEach((project) => {
      project.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  });

  filteredProjects = computed(() => {
    let filtered = this.projects();

    // Filter by search
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(
        (project) =>
          project.title.toLowerCase().includes(searchTerm) ||
          project.description.toLowerCase().includes(searchTerm) ||
          project.tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
      );
    }

    // Filter by tags
    const tags = this.selectedTags();
    if (tags.length > 0) {
      filtered = filtered.filter((project) =>
        tags.every((tag) => project.tags.includes(tag)),
      );
    }

    return filtered;
  });

  searchResults = computed(() => this.filteredProjects().length);

  hasMore = computed(() => {
    // Implement pagination logic
    return false;
  });

  ngOnInit() {
    this.loadProjects();
    this.setupSearch();
  }

  private loadProjects() {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService
      .getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (projects) => {
          this.projects.set(projects);
          this.visibleProjects.set(projects.slice(0, 6));
          this.isLoading.set(false);

          // Animate cards on load
          setTimeout(() => {
            const cards = document.querySelectorAll('.project-card');
            this.animationService.stagger(Array.from(cards) as HTMLElement[]);
          }, 100);
        },
        error: (err) => {
          this.error.set('Failed to load projects. Please try again.');
          this.isLoading.set(false);
          this.notificationService.error('Error loading projects');
        },
      });
  }

  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        // Search handled by computed signal
      });
  }

  toggleTag(tag: string) {
    const current = this.selectedTags();
    if (current.includes(tag)) {
      this.selectedTags.set(current.filter((t) => t !== tag));
    } else {
      this.selectedTags.set([...current, tag]);
    }
  }

  clearFilters() {
    this.searchControl.setValue('');
    this.selectedTags.set([]);
  }

  retry() {
    this.loadProjects();
  }

  loadMore() {
    this.isLoadingMore.set(true);
    // Implement load more logic
    setTimeout(() => {
      this.isLoadingMore.set(false);
    }, 1000);
  }

  onVisibleItemsChange(items: Project[]) {
    this.visibleProjects.set(items);
  }
}
