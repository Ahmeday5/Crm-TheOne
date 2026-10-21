import { Component } from '@angular/core';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';

@Component({
  selector: 'app-follow-ups',
  standalone: true,
  imports: [ResponsiveTableDirective],
  templateUrl: './follow-ups.component.html',
  styleUrl: './follow-ups.component.scss'
})
export class FollowUpsComponent {

}
