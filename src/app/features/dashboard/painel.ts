import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';

@Component({
  selector: 'app-painel',
  imports: [MatButtonModule, RouterLink],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Painel {
  private readonly autenticacao = inject(Autenticacao);
  readonly nome = this.autenticacao.nome;
  readonly indicadores = [
    { rotulo: 'Crianças ativas', tom: 'damasco' },
    { rotulo: 'Cadastros aguardando validação', tom: 'lilas' },
    { rotulo: 'Documentos aguardando análise', tom: 'menta' },
    { rotulo: 'Crianças com pendências', tom: 'manteiga' },
  ];
}
