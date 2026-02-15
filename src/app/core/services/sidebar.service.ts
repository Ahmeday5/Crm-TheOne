  import { Injectable } from '@angular/core';
  import { BehaviorSubject } from 'rxjs';

  @Injectable({ providedIn: 'root' })
  export class SidebarService {
    private sidebarState = new BehaviorSubject<boolean>(false);
    sidebar$ = this.sidebarState.asObservable();

    toggle() {
      this.sidebarState.next(!this.sidebarState.value);
    }

    open() {
      this.sidebarState.next(true);
    }

    close() {
      this.sidebarState.next(false);
    }
  }
