import { TestBed } from '@angular/core/testing';

import { ReportAndAnalyticsService } from './report-and-analytics.service';

describe('ReportAndAnalyticsService', () => {
  let service: ReportAndAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportAndAnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
