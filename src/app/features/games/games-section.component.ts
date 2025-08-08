import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';

interface Game {
  title: string;
  description: string;
  imageSrc: string;
  playLink: string;
  codeLink: string;
  plays?: number;
  rating?: string;
}

@Component({
  selector: 'app-games-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="games" class="games-section section">
      <div class="container">
        <div class="section-header animate-on-scroll">
          <h2 class="section-title">{{ t('games.title') }}</h2>
          <p class="section-subtitle">{{ t('games.subtitle') }}</p>
        </div>

        <div class="games-grid">
          @for (game of games(); track game.title) {
            <div
              class="game-card animate-on-scroll"
              [style.animation-delay.s]="$index * 0.1"
            >
              <div class="game-icon-wrapper">
                <img
                  [src]="game.imageSrc"
                  [alt]="game.title"
                  class="game-icon"
                  loading="lazy"
                />
                <div class="game-overlay">
                  <button
                    class="play-button"
                    (click)="playGame(game.playLink)"
                    [attr.aria-label]="'Play ' + game.title"
                  >
                    <i class="fas fa-play"></i>
                  </button>
                </div>
              </div>

              <div class="game-content">
                <h3 class="game-title">{{ game.title }}</h3>
                <p class="game-description">{{ game.description }}</p>

                <div class="game-stats">
                  <div class="stat">
                    <i class="fas fa-gamepad"></i>
                    <span>{{ game.plays }}+</span>
                  </div>
                  <div class="stat">
                    <i class="fas fa-star"></i>
                    <span>{{ game.rating }}</span>
                  </div>
                </div>

                <div class="game-actions">
                  <a
                    [href]="game.playLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="action-button play"
                  >
                    <i class="fas fa-play-circle"></i>
                    {{ t('games.play') }}
                  </a>
                  <a
                    [href]="game.codeLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="action-button code"
                  >
                    <i class="fab fa-github"></i>
                    {{ t('games.code') }}
                  </a>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="games-footer animate-on-scroll">
          <p class="games-note">{{ t('games.note') }}</p>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .games-section {
        padding: 5rem 0;
      }

      .section-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .section-title {
        font-size: clamp(2rem, 4vw, 3rem);
        margin-bottom: 1rem;
      }

      .section-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        max-width: 600px;
        margin: 0 auto;
      }

      /* Games Grid */
      .games-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-bottom: 3rem;
      }

      .game-card {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition:
          transform var(--transition-base) ease,
          box-shadow var(--transition-base) ease;
      }

      .game-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      }

      /* Game Icon */
      .game-icon-wrapper {
        position: relative;
        height: 200px;
        background: linear-gradient(
          135deg,
          var(--color-primary),
          var(--color-secondary)
        );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .game-icon {
        width: 120px;
        height: 120px;
        filter: brightness(0) invert(1);
        transition: transform var(--transition-base) ease;
      }

      .game-card:hover .game-icon {
        transform: scale(1.1);
      }

      .game-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity var(--transition-base) ease;
      }

      .game-card:hover .game-overlay {
        opacity: 1;
      }

      .play-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--color-primary);
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
          transform var(--transition-base) ease,
          background var(--transition-base) ease;
      }

      .play-button:hover {
        transform: scale(1.1);
        background: var(--color-primary-dark);
      }

      .play-button i {
        font-size: 1.5rem;
        margin-left: 4px;
      }

      /* Game Content */
      .game-content {
        padding: 1.5rem;
      }

      .game-title {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
      }

      .game-description {
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--text-secondary);
        margin-bottom: 1rem;
      }

      /* Game Stats */
      .game-stats {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 1rem;
        padding: 0.75rem 0;
        border-top: 1px solid var(--bg-tertiary);
        border-bottom: 1px solid var(--bg-tertiary);
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: var(--text-secondary);
      }

      .stat i {
        color: var(--color-primary);
      }

      /* Game Actions */
      .game-actions {
        display: flex;
        gap: 0.75rem;
      }

      .action-button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        border-radius: var(--radius-md);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all var(--transition-base) ease;
      }

      .action-button.play {
        background: var(--color-primary);
        color: white;
      }

      .action-button.play:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
      }

      .action-button.code {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 2px solid var(--bg-tertiary);
      }

      .action-button.code:hover {
        background: var(--bg-tertiary);
        transform: translateY(-2px);
      }

      .action-button i {
        font-size: 1rem;
      }

      /* Footer */
      .games-footer {
        text-align: center;
      }

      .games-note {
        font-size: 0.95rem;
        color: var(--text-secondary);
        font-style: italic;
      }

      /* Mobile */
      @media (max-width: 768px) {
        .games-section {
          padding: 3rem 0;
        }

        .games-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .game-icon-wrapper {
          height: 160px;
        }

        .game-icon {
          width: 100px;
          height: 100px;
        }
      }
    `,
  ],
})
export class GamesSectionComponent {
  constructor(private languageService: LanguageService) {
    this.initializeGamesData();
  }

  t(key: string): string {
    return this.languageService.t(key);
  }

  // Games data
  games = signal<Game[]>([]);

  // Initialize games data with static random values
  private initializeGamesData(): void {
    const gamesData: Game[] = [
      {
        title: 'Cosmic Shooter',
        description:
          'A space-themed shooter game with multiple levels and power-ups.',
        imageSrc: 'assets/icons/cosmic-shooter.svg',
        playLink: 'https://guziczak.github.io/games/cosmic-shooter',
        codeLink:
          'https://github.com/guziczak/games/blob/main/cosmic-shooter/index.html',
        plays: this.generateRandomPlays(),
        rating: this.generateRandomRating(),
      },
      {
        title: 'Speed Dash',
        description:
          'A fast-paced racing game with multiple tracks and vehicles.',
        imageSrc: 'assets/icons/speed-dash.svg',
        playLink: 'https://guziczak.github.io/games/speed-dash',
        codeLink:
          'https://github.com/guziczak/games/blob/main/speed-dash/index.html',
        plays: this.generateRandomPlays(),
        rating: this.generateRandomRating(),
      },
      {
        title: 'Sky Dodge',
        description:
          'An aerial dodge game with increasing difficulty and obstacles.',
        imageSrc: 'assets/icons/sky-dodge.svg',
        playLink: 'https://guziczak.github.io/games/sky-dodge',
        codeLink:
          'https://github.com/guziczak/games/blob/main/sky-dodge/index.html',
        plays: this.generateRandomPlays(),
        rating: this.generateRandomRating(),
      },
      {
        title: 'Snake Quest',
        description:
          'A modern take on the classic snake game with special power-ups.',
        imageSrc: 'assets/icons/snake-quest.svg',
        playLink: 'https://guziczak.github.io/games/snake-quest',
        codeLink:
          'https://github.com/guziczak/games/blob/main/snake-quest/index.html',
        plays: this.generateRandomPlays(),
        rating: this.generateRandomRating(),
      },
      {
        title: 'Icy Tower',
        description:
          'A vertical platformer game with random platforms and collectibles.',
        imageSrc: 'assets/icons/icy-tower.svg',
        playLink: 'https://guziczak.github.io/games/icy-tower',
        codeLink:
          'https://github.com/guziczak/games/blob/main/icy-tower/index.html',
        plays: this.generateRandomPlays(),
        rating: this.generateRandomRating(),
      },
    ];

    this.games.set(gamesData);
  }

  // Play game in new tab
  playGame(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Generate random play count (called once per game)
  private generateRandomPlays(): number {
    return Math.floor(Math.random() * 900) + 100;
  }

  // Generate random rating (called once per game)
  private generateRandomRating(): string {
    return (Math.random() * 2 + 3).toFixed(1);
  }
}
