import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TechnicalSupportLogComponent } from './technical-support-log.component';

describe('TechnicalSupportLogComponent', () => {
  let component: TechnicalSupportLogComponent;
  let fixture: ComponentFixture<TechnicalSupportLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicalSupportLogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TechnicalSupportLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
