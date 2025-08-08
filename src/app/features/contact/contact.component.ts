import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="contact-container">
      <h2>Contact works!</h2>
    </div>
  `,
  styles: [
    `
      .contact-container {
        padding: 20px;
      }
    `,
  ],
})
export class ContactComponent {}
