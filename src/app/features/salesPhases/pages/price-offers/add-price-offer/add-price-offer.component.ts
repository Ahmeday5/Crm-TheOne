import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-add-price-offer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './add-price-offer.component.html',
  styleUrl: './add-price-offer.component.scss',
})

export class AddPriceOfferComponent {
  constructor(private router: Router) {}

  goToSalesLine() {
    this.router.navigate(['/price-offers']);
  }
}
