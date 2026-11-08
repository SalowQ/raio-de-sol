import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Autenticacao } from '../../core/auth/autenticacao';

@Component({
  selector: 'app-configuracoes',
  imports: [MatCardModule],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracoes {
  private readonly autenticacao = inject(Autenticacao);
  readonly perfil = this.autenticacao.perfil;
  readonly email = computed(() => this.autenticacao.sessao()?.user.email ?? 'Não informado');
}
