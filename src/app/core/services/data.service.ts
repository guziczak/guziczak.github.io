import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, shareReplay, retry, timeout } from 'rxjs/operators';
import { NotificationService } from './notification.service';

export interface Skill {
  name: string;
  level: number;
}

export interface SkillCategory {
  category: string;
  items: Skill[];
}

export interface Project {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  tags: string[];
  projectLink: string;
  codeLink: string;
  featured?: boolean;
}

export interface Certificate {
  id: number;
  name: string;
  issuer: string;
  date: string;
  credential: string;
  skills: string[];
  category: string;
  logo: string;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface Experience {
  id: number;
  period: string;
  title: string;
  company: string;
  description: string;
  current: boolean;
  technologies: string[];
}

export interface Education {
  id: number;
  period: string;
  title: string;
  institution: string;
  description: string;
  current: boolean;
  skills: string[];
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  linkedinUrl?: string;
  quote: string;
  rating: number;
  avatar: string;
}

export interface Game {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  playLink: string;
  codeLink: string;
  tags: string[];
}

interface CacheEntry {
  data$: Observable<any>;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private notificationService = inject(NotificationService);
  private cache = new Map<string, CacheEntry>();
  
  private readonly CONFIG = {
    TIMEOUT_MS: 10000,
    RETRY_COUNT: 2,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
    RETRY_DELAY_MS: 1000,
    MAX_RETRY_DELAY_MS: 10000
  };

  private loadData<T>(path: string): Observable<T> {
    const cached = this.cache.get(path);
    const now = Date.now();
    
    // Check if cache exists and is still valid
    if (cached && (now - cached.timestamp) < this.CONFIG.CACHE_TTL_MS) {
      return cached.data$ as Observable<T>;
    }
    
    // Clear expired cache entry
    if (cached) {
      this.cache.delete(path);
    }
    
    const data$ = this.http.get<T>(`/data/${path}`).pipe(
      timeout(this.CONFIG.TIMEOUT_MS),
      this.retryWithBackoff(this.CONFIG.RETRY_COUNT),
      shareReplay(1),
      catchError((error) => {
        const errorMsg = `Failed to load ${path.replace('.json', '')} data`;
        console.error(errorMsg, error);
        this.notificationService.error(errorMsg);

        // Return empty default based on path
        if (path.includes('.json')) {
          return of({} as T);
        }
        return throwError(() => error);
      }),
    );
    
    this.cache.set(path, { data$, timestamp: now });
    return data$;
  }
  
  private retryWithBackoff<T>(maxRetries: number) {
    let retries = 0;
    return (source: Observable<T>) =>
      source.pipe(
        retry({
          count: maxRetries,
          delay: (error) => {
            retries++;
            const delay = Math.min(
              this.CONFIG.RETRY_DELAY_MS * Math.pow(2, retries - 1),
              this.CONFIG.MAX_RETRY_DELAY_MS
            );
            console.log(`Retrying after ${delay}ms (attempt ${retries}/${maxRetries})`);
            return timer(delay);
          }
        })
      );
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForPath(path: string): void {
    this.cache.delete(path);
  }

  getSkills(): Observable<SkillCategory[]> {
    return this.loadData<{ skills: SkillCategory[] }>('skills.json').pipe(
      map((data) => data?.skills || []),
    );
  }

  getProjects(): Observable<Project[]> {
    return this.loadData<{ projects: Project[] }>('projects.json').pipe(
      map((data) => data?.projects || []),
    );
  }

  getCertificates(): Observable<Certificate[]> {
    return this.loadData<{ certificates: Certificate[] }>(
      'certificates.json',
    ).pipe(map((data) => data?.certificates || []));
  }

  getAchievements(): Observable<Achievement[]> {
    return this.loadData<{ achievements: Achievement[] }>(
      'achievements.json',
    ).pipe(map((data) => data?.achievements || []));
  }

  getExperience(): Observable<Experience[]> {
    return this.loadData<{ experience: Experience[] }>('experience.json').pipe(
      map((data) => data?.experience || []),
    );
  }

  getEducation(): Observable<Education[]> {
    return this.loadData<{ education: Education[] }>('education.json').pipe(
      map((data) => data?.education || []),
    );
  }

  getTestimonials(): Observable<Testimonial[]> {
    return this.loadData<{ testimonials: Testimonial[] }>(
      'testimonials.json',
    ).pipe(map((data) => data?.testimonials || []));
  }

  getGames(): Observable<Game[]> {
    return this.loadData<{ games: Game[] }>('games.json').pipe(
      map((data) => data?.games || []),
    );
  }

  // Method for getting skills data for radar chart
  getSkillsForRadarChart(): Observable<any> {
    return this.getSkills().pipe(
      map((categories) => {
        const labels: string[] = [];
        const data: number[] = [];

        categories.forEach((category) => {
          // Calculate average for each category
          const avgLevel =
            category.items.reduce((sum, item) => sum + item.level, 0) /
            category.items.length;
          labels.push(category.category);
          data.push(Math.round(avgLevel));
        });

        return {
          labels,
          datasets: [
            {
              label: 'Skill Level',
              data,
              fill: true,
              backgroundColor: 'rgba(0, 112, 243, 0.2)',
              borderColor: 'rgb(0, 112, 243)',
              pointBackgroundColor: 'rgb(0, 112, 243)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(0, 112, 243)',
            },
          ],
        };
      }),
    );
  }
}
