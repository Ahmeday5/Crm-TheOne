import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TechnicalConsultationComponent } from './technical-consultation.component';

describe('TechnicalConsultationComponent', () => {
  let component: TechnicalConsultationComponent;
  let fixture: ComponentFixture<TechnicalConsultationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicalConsultationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TechnicalConsultationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
