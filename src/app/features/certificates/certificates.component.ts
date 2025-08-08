import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="certificates-container">
      <h2>Certificates works!</h2>
    </div>
  `,
  styles: [
    `
      .certificates-container {
        padding: 20px;
      }
    `,
  ],
})
export class CertificatesComponent {}
