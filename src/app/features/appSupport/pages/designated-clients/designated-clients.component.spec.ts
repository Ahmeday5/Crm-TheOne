import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignatedClientsComponent } from './designated-clients.component';

describe('DesignatedClientsComponent', () => {
  let component: DesignatedClientsComponent;
  let fixture: ComponentFixture<DesignatedClientsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignatedClientsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DesignatedClientsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
