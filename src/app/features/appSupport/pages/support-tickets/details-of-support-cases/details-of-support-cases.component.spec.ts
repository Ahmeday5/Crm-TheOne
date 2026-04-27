import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsOfSupportCasesComponent } from './details-of-support-cases.component';

describe('DetailsOfSupportCasesComponent', () => {
  let component: DetailsOfSupportCasesComponent;
  let fixture: ComponentFixture<DetailsOfSupportCasesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailsOfSupportCasesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailsOfSupportCasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
