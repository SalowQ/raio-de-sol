import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MAT_PAGINATOR_DEFAULT_OPTIONS,
  MatPaginatorIntl,
  MatPaginatorModule,
  type PageEvent,
} from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { rotuloPaginacao, TAMANHO_PAGINA } from '../criancas/paginacao';
import { AtendimentoServico, type AtendimentoCrianca } from './atendimento-servico';
import { diaLegivel, rotuloSituacao, textoFrequencia } from './regras-atendimento';
import { RegistroAtendimento } from './registro-atendimento';
import { ExcluirRegistro } from './excluir-registro';

@Component({
  selector: 'app-atendimentos-crianca',
  imports: [MatButtonModule, MatPaginatorModule, Carregando, EstadoErro, EstadoVazio],
  providers: [
    { provide: MatPaginatorIntl, useFactory: paginadorPortugues },
    {
      provide: MAT_PAGINATOR_DEFAULT_OPTIONS,
      useValue: { pageSize: TAMANHO_PAGINA || 10, hidePageSize: true },
    },
  ],
  templateUrl: './atendimentos-crianca.html',
  styleUrl: './atendimentos-crianca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtendimentosCrianca {
  private readonly atendimentos = inject(AtendimentoServico);
  private readonly dialogos = inject(MatDialog);

  readonly criancaId = input.required<string>();
  readonly itens = signal<AtendimentoCrianca[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly presentes = signal(0);
  readonly faltas = signal(0);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly tamanhoPagina = TAMANHO_PAGINA || 10;
  readonly diaLegivel = diaLegivel;
  readonly rotuloSituacao = rotuloSituacao;

  private pedido = 0;

  constructor() {
    effect(() => {
      const id = this.criancaId();
      this.pagina.set(0);
      void this.carregar(id, 0);
    });
  }

  frequencia(): string {
    return textoFrequencia(this.presentes(), this.faltas());
  }

  resumoPagina(): string {
    return rotuloPaginacao(this.pagina(), this.tamanhoPagina, this.total());
  }

  mudarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    void this.carregar(this.criancaId(), evento.pageIndex);
  }

  async adicionar(): Promise<void> {
    const salvo = await firstValueFrom(
      this.dialogos
        .open(RegistroAtendimento, {
          data: { criancaId: this.criancaId() },
          width: '32rem',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
    if (salvo) {
      this.pagina.set(0);
      await this.carregar(this.criancaId(), 0);
    }
  }

  async editar(item: AtendimentoCrianca): Promise<void> {
    const salvo = await firstValueFrom(
      this.dialogos
        .open(RegistroAtendimento, {
          data: {
            criancaId: this.criancaId(),
            registro: {
              id: item.id,
              dia: item.dia,
              situacao: item.situacao,
              anotacao: item.anotacao,
            },
          },
          width: '32rem',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
    if (salvo) {
      await this.carregar(this.criancaId(), this.pagina());
    }
  }

  async excluir(item: AtendimentoCrianca): Promise<void> {
    const confirma = await firstValueFrom(
      this.dialogos
        .open(ExcluirRegistro, {
          data: { dia: diaLegivel(item.dia) },
          width: '28rem',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
    if (!confirma) {
      return;
    }

    this.erro.set(null);
    try {
      await this.atendimentos.excluir(item.id);
      const pagina = this.itens().length === 1 && this.pagina() > 0 ? this.pagina() - 1 : this.pagina();
      this.pagina.set(pagina);
      await this.carregar(this.criancaId(), pagina);
    } catch (erro: unknown) {
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    }
  }

  private async carregar(criancaId: string, pagina: number): Promise<void> {
    const pedido = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.atendimentos.listarDaCrianca(criancaId, pagina);
      if (pedido !== this.pedido) {
        return;
      }
      this.itens.set(resultado.itens);
      this.total.set(resultado.total);
      this.presentes.set(resultado.presentes);
      this.faltas.set(resultado.faltas);
    } catch (erro: unknown) {
      if (pedido !== this.pedido) {
        return;
      }
      this.itens.set([]);
      this.total.set(0);
      this.presentes.set(0);
      this.faltas.set(0);
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }
}

function paginadorPortugues(): MatPaginatorIntl {
  const paginador = new MatPaginatorIntl();
  paginador.itemsPerPageLabel = 'Por página';
  paginador.nextPageLabel = 'Próxima página';
  paginador.previousPageLabel = 'Página anterior';
  paginador.firstPageLabel = 'Primeira página';
  paginador.lastPageLabel = 'Última página';
  paginador.getRangeLabel = (pagina, tamanho, total) => rotuloPaginacao(pagina, tamanho, total);
  return paginador;
}
