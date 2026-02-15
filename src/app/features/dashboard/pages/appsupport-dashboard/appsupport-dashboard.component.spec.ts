import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppsupportDashboardComponent } from './appsupport-dashboard.component';

describe('AppsupportDashboardComponent', () => {
  let component: AppsupportDashboardComponent;
  let fixture: ComponentFixture<AppsupportDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppsupportDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppsupportDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
