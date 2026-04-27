import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TasksManageComponent } from './tasks-manage.component';

describe('TasksManageComponent', () => {
  let component: TasksManageComponent;
  let fixture: ComponentFixture<TasksManageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasksManageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TasksManageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
