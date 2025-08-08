import {
  Component,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { DataService } from '../../../core/services/data.service';
import { ThemeService } from '../../../core/services/theme.service';

Chart.register(...registerables);

@Component({
  selector: 'app-skills-radar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container" [class.visible]="isVisible()">
      <h3>Skills Overview</h3>
      <div class="chart-wrapper">
        <canvas #radarChart></canvas>
      </div>
    </div>
  `,
  styles: [
    `
      .chart-container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: var(--bg-secondary);
        border-radius: 12px;
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        cursor: pointer;
      }

      .chart-container:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 30px rgba(0, 0, 0, 0.1);
      }

      .chart-container h3 {
        text-align: center;
        margin-bottom: 20px;
        color: var(--text-primary);
        font-size: 1.5rem;
      }

      .chart-wrapper {
        position: relative;
        height: 400px;
        width: 100%;
      }

      @media (max-width: 768px) {
        .chart-wrapper {
          height: 300px;
        }
      }
    `,
  ],
})
export class SkillsRadarChartComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('radarChart') radarChartRef!: ElementRef<HTMLCanvasElement>;

  private dataService = inject(DataService);
  private themeService = inject(ThemeService);
  private chart: Chart | null = null;
  private chartData = signal<any>(null);
  protected isVisible = signal(false);
  private observer: IntersectionObserver | null = null;
  private originalData: number[] = [];

  ngOnInit() {
    this.loadChartData();
  }

  ngAfterViewInit() {
    if (this.chartData()) {
      this.createChart();
    }

    // Subscribe to theme changes
    this.themeService.isDarkMode$.subscribe((isDark: boolean) => {
      if (this.chart) {
        this.updateChartTheme(isDark);
      }
    });

    // Setup intersection observer for entrance animation
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver() {
    const options = {
      threshold: 0.3,
      rootMargin: '0px'
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isVisible()) {
          this.isVisible.set(true);
          this.animateChartData();
        }
      });
    }, options);

    const element = this.radarChartRef.nativeElement.parentElement?.parentElement;
    if (element) {
      this.observer.observe(element);
    }
  }

  private animateChartData() {
    if (!this.chart || !this.originalData.length) return;

    // Animate from 0 to actual values
    const steps = 20;
    const duration = 1000; // 1 second
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps; i++) {
      setTimeout(() => {
        const progress = i / steps;
        const newData = this.originalData.map(value => value * progress);
        if (this.chart && this.chart.data.datasets[0]) {
          this.chart.data.datasets[0].data = newData;
          this.chart.update('none'); // Update without animation
        }
      }, i * stepDuration);
    }
  }

  private loadChartData() {
    this.dataService.getSkillsForRadarChart().subscribe((data) => {
      this.chartData.set(data);
      if (this.radarChartRef) {
        this.createChart();
      }
    });
  }

  private createChart() {
    const ctx = this.radarChartRef.nativeElement.getContext('2d');
    if (!ctx || !this.chartData()) return;

    const isDark = this.themeService.isDarkMode();

    // Store original data for animation
    this.originalData = [...this.chartData().datasets[0].data];
    
    // Start with zero values if not visible yet
    if (!this.isVisible()) {
      this.chartData().datasets[0].data = this.originalData.map(() => 0);
    }

    this.chart = new Chart(ctx, {
      type: 'radar',
      data: this.chartData(),
      options: {
        responsive: true,
        maintainAspectRatio: true,
        elements: {
          line: {
            tension: 0.3
          },
          point: {
            hoverRadius: 8,
            hoverBackgroundColor: '#fff',
            hoverBorderColor: 'rgba(0, 112, 243, 1)',
            hoverBorderWidth: 2
          }
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.label + ': ' + context.parsed.r + '%';
              },
            },
          },
        },
        scales: {
          r: {
            angleLines: {
              display: true,
              color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            },
            grid: {
              color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            },
            pointLabels: {
              color: isDark ? '#f3f4f6' : '#1f2937',
              font: {
                size: 12,
                weight: 500 as const,
              },
            },
            ticks: {
              color: isDark ? '#9ca3af' : '#6b7280',
              backdropColor: 'transparent',
              stepSize: 20,
              callback: function (value) {
                return value + '%';
              },
            },
            beginAtZero: true,
            max: 100,
          },
        },
      },
    });
  }

  private updateChartTheme(isDark: boolean) {
    if (!this.chart) return;

    // Update colors based on theme
    const scales = this.chart.options.scales as any;
    if (scales && scales['r']) {
      const rScale = scales['r'];
      if (rScale.angleLines) {
        rScale.angleLines.color = isDark
          ? 'rgba(255, 255, 255, 0.1)'
          : 'rgba(0, 0, 0, 0.1)';
      }
      if (rScale.grid) {
        rScale.grid.color = isDark
          ? 'rgba(255, 255, 255, 0.1)'
          : 'rgba(0, 0, 0, 0.1)';
      }
      if (rScale.pointLabels) {
        rScale.pointLabels.color = isDark ? '#f3f4f6' : '#1f2937';
      }
      if (rScale.ticks) {
        rScale.ticks.color = isDark ? '#9ca3af' : '#6b7280';
      }
    }

    this.chart.update();
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
