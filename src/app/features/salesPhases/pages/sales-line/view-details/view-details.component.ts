import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-view-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-details.component.html',
  styleUrl: './view-details.component.scss',
})
export class ViewDetailsComponent {
  constructor(private router: Router) {}

  goToSalesLine() {
    this.router.navigate(['/line']);
  }
}
