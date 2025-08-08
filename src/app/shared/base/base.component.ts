import { Directive, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Directive()
export abstract class BaseComponent implements OnDestroy {
  protected destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Użycie:
// export class MyComponent extends BaseComponent {
//   ngOnInit() {
//     this.someService.data$
//       .pipe(takeUntil(this.destroy$))
//       .subscribe(data => {
//         // handle data
//       });
//   }
// }
