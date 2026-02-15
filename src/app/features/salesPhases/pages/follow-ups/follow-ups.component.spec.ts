import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowUpsComponent } from './follow-ups.component';

describe('FollowUpsComponent', () => {
  let component: FollowUpsComponent;
  let fixture: ComponentFixture<FollowUpsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FollowUpsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowUpsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
