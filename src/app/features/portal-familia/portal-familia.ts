import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-portal-familia',
  template: `
    <h1>Instituto Raio de Sol</h1>
    <p>Este endereço ainda não está disponível. Use o link enviado pela instituição.</p>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 32rem);
      padding: 2rem 1.5rem;
      border-radius: 1.5rem;
      background: #fffdfb;
      box-shadow: 0 12px 32px rgb(92 48 18 / 8%);
    }

    h1 {
      margin-top: 0;
    }

    p {
      max-width: 36rem;
      color: #6e564a;
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalFamilia {}
