import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { destinoVoltar, HistoricoNavegacao } from '../../../core/historico-navegacao';

@Component({
  selector: 'app-botao-voltar',
  templateUrl: './botao-voltar.html',
  styleUrl: './botao-voltar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoVoltar {
  private readonly historico = inject(HistoricoNavegacao);
  private readonly rotas = inject(Router);
  private readonly atual = toSignal(
    this.rotas.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.rotas.url },
  );

  readonly destino = computed(() => destinoVoltar(this.historico.anterior(), this.atual()));
  readonly visivel = computed(() => this.destino() !== null);

  voltar(): void {
    const destino = this.destino();
    if (destino) {
      void this.rotas.navigateByUrl(destino);
    }
  }
}
