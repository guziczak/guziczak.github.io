import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="games-container">
      <h2>Games works!</h2>
    </div>
  `,
  styles: [
    `
      .games-container {
        padding: 20px;
      }
    `,
  ],
})
export class GamesComponent {}
