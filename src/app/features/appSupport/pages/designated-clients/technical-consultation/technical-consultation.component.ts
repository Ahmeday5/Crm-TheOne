import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-technical-consultation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './technical-consultation.component.html',
  styleUrl: './technical-consultation.component.scss'
})

export class TechnicalConsultationComponent {

  constructor(private route: Router) {}

  goToDesignatedClients() {
    this.route.navigate(['/Designated-clients']);
  }

}
