import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPriceOfferComponent } from './add-price-offer.component';

describe('AddPriceOfferComponent', () => {
  let component: AddPriceOfferComponent;
  let fixture: ComponentFixture<AddPriceOfferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPriceOfferComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPriceOfferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
