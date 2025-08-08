import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { DataService } from './data.service';
import { NotificationService } from './notification.service';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;
  let notificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj('NotificationService', [
      'error',
      'success',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DataService,
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });

    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
    notificationService = TestBed.inject(
      NotificationService,
    ) as jasmine.SpyObj<NotificationService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch projects successfully', () => {
    const mockProjects = [
      {
        id: 1,
        title: 'Project 1',
        description: 'Description 1',
        tags: ['tag1'],
      },
      {
        id: 2,
        title: 'Project 2',
        description: 'Description 2',
        tags: ['tag2'],
      },
    ];

    service.getProjects().subscribe((projects) => {
      expect(projects).toEqual(mockProjects);
    });

    const req = httpMock.expectOne('/data/projects.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockProjects);
  });

  it('should cache projects after first fetch', () => {
    const mockProjects = [
      {
        id: 1,
        title: 'Project 1',
        description: 'Description 1',
        tags: ['tag1'],
      },
    ];

    // First call
    service.getProjects().subscribe();
    const req = httpMock.expectOne('/data/projects.json');
    req.flush(mockProjects);

    // Second call should use cache
    service.getProjects().subscribe((projects) => {
      expect(projects).toEqual(mockProjects);
    });

    // No additional HTTP request should be made
    httpMock.expectNone('/data/projects.json');
  });

  it('should fetch skills successfully', () => {
    const mockSkills = [
      { name: 'Angular', category: 'Frontend', proficiency: 90 },
      { name: 'TypeScript', category: 'Frontend', proficiency: 85 },
    ];

    service.getSkills().subscribe((skills) => {
      expect(skills).toEqual(mockSkills);
    });

    const req = httpMock.expectOne('/data/skills.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockSkills);
  });

  it('should fetch certificates successfully', () => {
    const mockCertificates = [
      { id: 1, title: 'Certificate 1', issuer: 'Issuer 1', date: '2023-01-01' },
    ];

    service.getCertificates().subscribe((certificates) => {
      expect(certificates).toEqual(mockCertificates);
    });

    const req = httpMock.expectOne('/data/certificates.json');
    req.flush(mockCertificates);
  });

  it('should fetch achievements successfully', () => {
    const mockAchievements = [
      {
        id: 1,
        title: 'Achievement 1',
        description: 'Description 1',
        icon: 'icon1',
      },
    ];

    service.getAchievements().subscribe((achievements) => {
      expect(achievements).toEqual(mockAchievements);
    });

    const req = httpMock.expectOne('/data/achievements.json');
    req.flush(mockAchievements);
  });

  it('should fetch experience successfully', () => {
    const mockExperience = [
      {
        id: 1,
        company: 'Company 1',
        position: 'Position 1',
        startDate: '2020-01-01',
      },
    ];

    service.getExperience().subscribe((experience) => {
      expect(experience).toEqual(mockExperience);
    });

    const req = httpMock.expectOne('/data/experience.json');
    req.flush(mockExperience);
  });

  it('should fetch education successfully', () => {
    const mockEducation = [
      {
        id: 1,
        institution: 'University',
        degree: 'Bachelor',
        startDate: '2016-09-01',
      },
    ];

    service.getEducation().subscribe((education) => {
      expect(education).toEqual(mockEducation);
    });

    const req = httpMock.expectOne('/data/education.json');
    req.flush(mockEducation);
  });

  it('should fetch testimonials successfully', () => {
    const mockTestimonials = [
      { id: 1, name: 'John Doe', role: 'CEO', content: 'Great work!' },
    ];

    service.getTestimonials().subscribe((testimonials) => {
      expect(testimonials).toEqual(mockTestimonials);
    });

    const req = httpMock.expectOne('/data/testimonials.json');
    req.flush(mockTestimonials);
  });

  it('should fetch games successfully', () => {
    const mockGames = [
      { id: 1, title: 'Game 1', description: 'Description 1', url: 'url1' },
    ];

    service.getGames().subscribe((games) => {
      expect(games).toEqual(mockGames);
    });

    const req = httpMock.expectOne('/data/games.json');
    req.flush(mockGames);
  });

  it('should handle HTTP error gracefully', () => {
    const errorMessage = 'Failed to load data';

    service.getProjects().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(error.status).toBe(404);
      },
    );

    const req = httpMock.expectOne('/data/projects.json');
    req.flush(errorMessage, { status: 404, statusText: 'Not Found' });

    expect(notificationService.error).toHaveBeenCalledWith(
      'Failed to load projects data',
    );
  });

  it('should retry on error before failing', () => {
    let attempts = 0;

    service.getSkills().subscribe(
      () => fail('should have failed'),
      (error) => {
        expect(attempts).toBe(3); // Initial + 2 retries
      },
    );

    const requests = httpMock.match('/data/skills.json');
    expect(requests.length).toBe(1);

    requests.forEach((req) => {
      attempts++;
      req.flush('Error', { status: 500, statusText: 'Server Error' });
    });
  });
});
