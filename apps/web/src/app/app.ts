import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SessionService } from '../core/session/session.service';
import { FooterComponent } from '../shared/layout/footer/footer.component';
import { HeaderComponent } from '../shared/layout/header/header.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly session = inject(SessionService);
  protected readonly profile = this.session.profile;
  protected readonly contextLabel = computed(() => {
    const p = this.profile();
    if (!p) return null;
    return p.serviceName ? `${p.jurisdictionName} — ${p.serviceName}` : p.jurisdictionName;
  });
}
