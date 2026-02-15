import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-sales-phase',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './sales-phase.component.html',
  styleUrl: './sales-phase.component.scss'
})
export class SalesPhaseComponent {

}
