import { Component } from '@angular/core';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';

@Component({
  selector: 'app-technical-support-log',
  standalone: true,
  imports: [ClampTextDirective, ResponsiveTableDirective],
  templateUrl: './technical-support-log.component.html',
  styleUrl: './technical-support-log.component.scss'
})
export class TechnicalSupportLogComponent {

}
