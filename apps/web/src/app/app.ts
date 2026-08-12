import { Component, inject, type OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthenticationService } from './auth/authentication.service';

type AuthenticationState = 'checking' | 'authenticated' | 'redirecting' | 'error';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly authentication = inject(AuthenticationService);

  protected readonly authenticationState = signal<AuthenticationState>('checking');
  protected readonly title = signal('Dépôt automatisé de documents');

  ngOnInit(): void {
    void this.authenticate();
  }

  private async authenticate(): Promise<void> {
    try {
      const result = await this.authentication.requireAuthentication();
      this.authenticationState.set(result);
    } catch {
      this.authenticationState.set('error');
    }
  }
}
