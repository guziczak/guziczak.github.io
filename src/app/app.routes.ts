import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-page/home-page.component').then(
        (m) => m.HomePageComponent,
      ),
  },
  {
    path: 'certificates',
    loadComponent: () =>
      import('./pages/certificates-page/certificates-page.component').then(
        (m) => m.CertificatesPageComponent,
      ),
  },
  {
    path: 'cv',
    loadComponent: () =>
      import('./pages/cv-page/cv-page.component').then(
        (m) => m.CvPageComponent,
      ),
  },
  {
    path: 'cv-print',
    loadComponent: () =>
      import('./pages/cv-print-page/cv-print-page.component').then(
        (m) => m.CvPrintPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
