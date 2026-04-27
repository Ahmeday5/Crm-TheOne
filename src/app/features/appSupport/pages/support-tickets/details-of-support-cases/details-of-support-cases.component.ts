import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-details-of-support-cases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details-of-support-cases.component.html',
  styleUrl: './details-of-support-cases.component.scss',
})
export class DetailsOfSupportCasesComponent {
  constructor(private route: Router) {}

  goToSupportTickets() {
    this.route.navigate(['/SupportTickets']);
  }
}
