import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-sales-line',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './sales-line.component.html',
  styleUrl: './sales-line.component.scss'
})
export class SalesLineComponent {

}
