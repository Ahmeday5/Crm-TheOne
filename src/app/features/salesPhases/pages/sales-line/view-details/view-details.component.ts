import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ClampTextDirective } from '../../../../../shared/directives/clamp-text.directive';

@Component({
  selector: 'app-view-details',
  standalone: true,
  imports: [CommonModule, ClampTextDirective],
  templateUrl: './view-details.component.html',
  styleUrl: './view-details.component.scss',
})
export class ViewDetailsComponent {
  constructor(private router: Router) {}

  goToSalesLine() {
    this.router.navigate(['/line']);
  }
}
