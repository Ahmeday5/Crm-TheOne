import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeReportsComponent } from './employee-reports.component';

describe('EmployeeReportsComponent', () => {
  let component: EmployeeReportsComponent;
  let fixture: ComponentFixture<EmployeeReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
