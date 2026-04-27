import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './support-tickets.component.html',
  styleUrl: './support-tickets.component.scss',
})
export class SupportTicketsComponent {
  constructor(private route: Router) {}

  goToDetailsOfSupportCases() {
    this.route.navigate(['/details-of-support-cases']);
  }
}
