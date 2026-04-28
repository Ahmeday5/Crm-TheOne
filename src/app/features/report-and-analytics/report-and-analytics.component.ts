import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-report-and-analytics',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, PageHeaderComponent],
  templateUrl: './report-and-analytics.component.html',
  styleUrl: './report-and-analytics.component.scss'
})
export class ReportAndAnalyticsComponent {

}
