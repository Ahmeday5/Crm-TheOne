import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesLineComponent } from './sales-line.component';

describe('SalesLineComponent', () => {
  let component: SalesLineComponent;
  let fixture: ComponentFixture<SalesLineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesLineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesLineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
