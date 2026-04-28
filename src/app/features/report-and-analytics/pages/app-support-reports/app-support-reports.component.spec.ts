import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSupportReportsComponent } from './app-support-reports.component';

describe('AppSupportReportsComponent', () => {
  let component: AppSupportReportsComponent;
  let fixture: ComponentFixture<AppSupportReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSupportReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppSupportReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
