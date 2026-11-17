import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { PainelServico, type ContagensPainel } from './painel-servico';

export interface IndicadorPainel {
  rotulo: string;
  tom: string;
  valor: number;
  caminho: string | null;
  parametros: Record<string, string> | null;
}

@Component({
  selector: 'app-painel',
  imports: [MatButtonModule, RouterLink, Carregando, EstadoErro],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Painel implements OnInit {
  private readonly autenticacao = inject(Autenticacao);
  private readonly servico = inject(PainelServico);

  readonly nome = this.autenticacao.nome;
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly indicadores = signal<IndicadorPainel[]>([]);

  ngOnInit(): void {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);

    try {
      this.indicadores.set(montarIndicadores(await this.servico.contagens()));
    } catch (erro) {
      this.erro.set(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.carregando.set(false);
    }
  }
}

export function montarIndicadores(contagens: ContagensPainel): IndicadorPainel[] {
  return [
    {
      rotulo: 'Crianças ativas',
      tom: 'damasco',
      valor: contagens.ativas,
      caminho: '/criancas',
      parametros: { situacao: 'ativo' },
    },
    {
      rotulo: 'Cadastros aguardando validação',
      tom: 'lilas',
      valor: contagens.aguardandoValidacao,
      caminho: '/criancas',
      parametros: { situacao: 'pendente_validacao' },
    },
    {
      rotulo: 'Documentos aguardando análise',
      tom: 'menta',
      valor: contagens.documentosEmAnalise,
      caminho: null,
      parametros: null,
    },
    {
      rotulo: 'Crianças com pendências',
      tom: 'manteiga',
      valor: contagens.criancasComPendencia,
      caminho: null,
      parametros: null,
    },
  ];
}
