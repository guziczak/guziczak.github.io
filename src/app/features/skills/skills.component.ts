import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skills-container">
      <h2>Skills works!</h2>
    </div>
  `,
  styles: [
    `
      .skills-container {
        padding: 20px;
      }
    `,
  ],
})
export class SkillsComponent {}
