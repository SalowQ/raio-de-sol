import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { HistoricoNavegacao } from './core/historico-navegacao';
import { TituloInstituto } from './core/titulo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: TituloInstituto },
    provideAppInitializer(() => {
      inject(HistoricoNavegacao);
    }),
  ],
};
