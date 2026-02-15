import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesPhaseComponent } from './sales-phase.component';

describe('SalesPhaseComponent', () => {
  let component: SalesPhaseComponent;
  let fixture: ComponentFixture<SalesPhaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesPhaseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesPhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
