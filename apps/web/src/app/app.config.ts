import { provideHttpClient } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { DocumentsMock } from '../core/documents/documents.mock';
import { DOCUMENTS_SERVICE } from '../core/documents/documents.service';
import { SessionService } from '../core/session/session.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideOAuthClient(),
    provideAppInitializer(() => inject(SessionService).initialize()),
    { provide: DOCUMENTS_SERVICE, useClass: DocumentsMock },
  ],
};
