import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { marketingGuard } from './marketing.guard';

describe('marketingGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => marketingGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
