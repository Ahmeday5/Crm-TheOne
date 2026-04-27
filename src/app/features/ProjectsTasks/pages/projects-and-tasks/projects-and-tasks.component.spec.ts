import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsAndTasksComponent } from './projects-and-tasks.component';

describe('ProjectsAndTasksComponent', () => {
  let component: ProjectsAndTasksComponent;
  let fixture: ComponentFixture<ProjectsAndTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsAndTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectsAndTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
