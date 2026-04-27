import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardAppSupportComponent } from './dashboard-app-support.component';

describe('DashboardAppSupportComponent', () => {
  let component: DashboardAppSupportComponent;
  let fixture: ComponentFixture<DashboardAppSupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardAppSupportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardAppSupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
