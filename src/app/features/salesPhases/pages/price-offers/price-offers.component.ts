import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-price-offers',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './price-offers.component.html',
  styleUrl: './price-offers.component.scss',
})
export class PriceOffersComponent {}
