import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';

@Component({
  selector: 'app-acesso-negado',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './acesso-negado.html',
  styleUrl: './acesso-negado.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcessoNegado {
  private readonly autenticacao = inject(Autenticacao);
  private readonly router = inject(Router);

  async sair(): Promise<void> {
    await this.autenticacao.sair();
    await this.router.navigateByUrl('/entrar');
  }
}
