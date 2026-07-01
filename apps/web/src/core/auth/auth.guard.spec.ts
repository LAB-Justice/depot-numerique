import { TestBed } from '@angular/core/testing';

import { SessionService } from '../session/session.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  it('allows access when the session is authenticated', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionService, useValue: { isAuthenticated: () => true } }],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('triggers the OIDC login flow when the session is not authenticated', () => {
    let loginCalls = 0;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionService,
          useValue: { isAuthenticated: () => false, login: () => loginCalls++ },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(loginCalls).toBe(1);
    expect(result).toBe(false);
  });
});
