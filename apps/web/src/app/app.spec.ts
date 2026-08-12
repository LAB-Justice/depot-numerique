import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { type AuthenticationResult, AuthenticationService } from './auth/authentication.service';

describe('App', () => {
  const authentication = {
    requireAuthentication: vi.fn<AuthenticationService['requireAuthentication']>(),
  };

  beforeEach(async () => {
    authentication.requireAuthentication.mockResolvedValue('authenticated');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthenticationService, useValue: authentication }],
    }).compileComponents();
  });

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Dépôt automatisé de documents');
  });

  it('should not render the application before the session check completes', () => {
    authentication.requireAuthentication.mockReturnValue(
      new Promise<AuthenticationResult>(() => undefined),
    );

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Connexion sécurisée');
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });

  it('should render a closed state without a button when SSO fails', async () => {
    authentication.requireAuthentication.mockRejectedValue(new Error('SSO indisponible'));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Connexion impossible');
    expect(compiled.querySelector('button')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });
});
