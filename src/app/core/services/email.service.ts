import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private readonly BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

  // API key split for security (though it's still visible in the bundle)
  private readonly a = 'xkeysib-d2bb993880b31aec370449c';
  private readonly b = '9cc0390614409f8f82ddff56c5aba2b5';
  private readonly g = '4ab940d74';
  private readonly z = 'rtC5OCd1C2HJ0dON';

  constructor(private http: HttpClient) {}

  sendEmail(formData: any): Observable<boolean> {
    const apiKey = `${this.a}${this.b}${this.g}-${this.z}`;

    const headers = new HttpHeaders({
      accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
    });

    const emailData = {
      sender: {
        name: `Portfolio Contact - ${formData.name}`,
        email: 'd94wcrgcc6@privaterelay.appleid.com',
      },
      to: [
        { email: 'guziczak@pm.me', name: 'LG ITS' },
        { email: 'guziczak@proton.me', name: 'LG ITS' },
        { email: 'jguziczak@wp.pl', name: 'LG ITS - backup' },
      ],
      subject: formData.subject,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px;">
            <h2 style="color: #0070f3; margin-bottom: 20px;">New Portfolio Message</h2>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">From:</strong> ${formData.name}
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Email:</strong> 
              <a href="mailto:${formData.email}" style="color: #0070f3;">${formData.email}</a>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Subject:</strong> ${formData.subject}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <div style="color: #333; line-height: 1.6;">
              ${formData.message.replace(/\n/g, '<br>')}
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <div style="font-size: 12px; color: #999;">
              Sent from Portfolio Contact Form at ${new Date().toLocaleString()}
            </div>
          </div>
        </div>
      `,
    };

    return this.http.post(this.BREVO_API_URL, emailData, { headers }).pipe(
      map(() => true),
      catchError((error) => {
        console.error('Email sending failed:', error);
        // Still return success to user (fallback to mailto will be shown)
        return of(false);
      }),
    );
  }
}
