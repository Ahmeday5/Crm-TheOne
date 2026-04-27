import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-projects-and-tasks',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, PageHeaderComponent],
  templateUrl: './projects-and-tasks.component.html',
  styleUrl: './projects-and-tasks.component.scss',
})
export class ProjectsAndTasksComponent {}
