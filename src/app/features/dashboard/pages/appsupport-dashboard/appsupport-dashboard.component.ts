import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-appsupport-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe, PageHeaderComponent],
  templateUrl: './appsupport-dashboard.component.html',
  styleUrl: './appsupport-dashboard.component.scss',
})
export class AppsupportDashboardComponent {}
