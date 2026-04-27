import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppSupportMainComponent } from './app-support-main.component';

describe('AppSupportMainComponent', () => {
  let component: AppSupportMainComponent;
  let fixture: ComponentFixture<AppSupportMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSupportMainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppSupportMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
