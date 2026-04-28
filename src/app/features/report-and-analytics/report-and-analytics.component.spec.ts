import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportAndAnalyticsComponent } from './report-and-analytics.component';

describe('ReportAndAnalyticsComponent', () => {
  let component: ReportAndAnalyticsComponent;
  let fixture: ComponentFixture<ReportAndAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportAndAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportAndAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
