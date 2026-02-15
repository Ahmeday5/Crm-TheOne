import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingLeadsComponent } from './marketing-leads.component';

describe('MarketingLeadsComponent', () => {
  let component: MarketingLeadsComponent;
  let fixture: ComponentFixture<MarketingLeadsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingLeadsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingLeadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
