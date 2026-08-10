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

  it('n’affiche pas l’application avant la vérification de session', () => {
    authentication.requireAuthentication.mockReturnValue(
      new Promise<AuthenticationResult>(() => undefined),
    );

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Connexion sécurisée');
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });

  it('affiche un état fermé sans bouton si le SSO échoue', async () => {
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
