import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { AtendimentoServico, type DiaAtendimento, type RegistroDoDia } from './atendimento-servico';
import { diaLegivel, rotuloSituacao, textoQuantidadeRegistros } from './regras-atendimento';
import { pedirConfirmacao } from '../../shared/components/confirmar-exclusao/confirmar-exclusao';
import { RegistroAtendimento } from './registro-atendimento';

@Component({
  selector: 'app-presencas',
  imports: [MatButtonModule, MatPaginatorModule, Carregando, EstadoErro, EstadoVazio],
  providers: [
    { provide: MatPaginatorIntl, useFactory: paginadorPortugues },
    {
      provide: MAT_PAGINATOR_DEFAULT_OPTIONS,
      useValue: { pageSize: TAMANHO_PAGINA || 10, hidePageSize: true },
    },
  ],
  templateUrl: './presencas.html',
  styleUrl: './presencas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Presencas implements OnInit {
  private readonly atendimentos = inject(AtendimentoServico);
  private readonly dialogos = inject(MatDialog);

  readonly dias = signal<DiaAtendimento[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly abertos = signal<ReadonlySet<string>>(new Set());
  readonly registros = signal<ReadonlyMap<string, RegistroDoDia[]>>(new Map());
  readonly carregandoDia = signal<ReadonlySet<string>>(new Set());
  readonly errosDia = signal<ReadonlyMap<string, string>>(new Map());
  readonly tamanhoPagina = TAMANHO_PAGINA || 10;
  readonly diaLegivel = diaLegivel;
  readonly rotuloSituacao = rotuloSituacao;
  readonly textoQuantidade = textoQuantidadeRegistros;

  private pedido = 0;

  ngOnInit(): void {
    void this.carregar(0);
  }

  resumoPagina(): string {
    return rotuloPaginacao(this.pagina(), this.tamanhoPagina, this.total());
  }

  aberto(dia: string): boolean {
    return this.abertos().has(dia);
  }

  carregandoEste(dia: string): boolean {
    return this.carregandoDia().has(dia);
  }

  erroDeste(dia: string): string | null {
    return this.errosDia().get(dia) ?? null;
  }

  registrosDeste(dia: string): RegistroDoDia[] {
    return this.registros().get(dia) ?? [];
  }

  mudarPagina(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.fecharDias();
    void this.carregar(evento.pageIndex);
  }

  async alternar(dia: string): Promise<void> {
    if (this.abertos().has(dia)) {
      this.abertos.update((conjunto) => sem(conjunto, dia));
      return;
    }

    this.abertos.update((conjunto) => com(conjunto, dia));
    await this.carregarDia(dia);
  }

  async adicionar(): Promise<void> {
    const salvo = await firstValueFrom(
      this.dialogos
        .open(RegistroAtendimento, {
          data: { escolherCrianca: true },
          width: '32rem',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
    if (salvo) {
      this.pagina.set(0);
      await this.recarregarAberto();
    }
  }

  async editar(dia: string, registro: RegistroDoDia): Promise<void> {
    const salvo = await firstValueFrom(
      this.dialogos
        .open(RegistroAtendimento, {
          data: {
            registro: {
              id: registro.id,
              dia,
              situacao: registro.situacao,
              anotacao: registro.anotacao,
            },
          },
          width: '32rem',
          autoFocus: 'first-tabbable',
        })
        .afterClosed(),
    );
    if (salvo) {
      await this.recarregarAberto(dia);
    }
  }

  async excluir(dia: string, registro: RegistroDoDia): Promise<void> {
    const confirma = await pedirConfirmacao(this.dialogos, {
      titulo: 'Excluir registro',
      mensagem: `O registro de ${diaLegivel(dia)} de ${registro.nome} será excluído.`,
    });
    if (!confirma) {
      return;
    }

    try {
      await this.atendimentos.excluir(registro.id);
      await this.recarregarAberto(dia);
    } catch (erro: unknown) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';
      this.errosDia.update((mapa) => new Map(mapa).set(dia, mensagem));
    }
  }

  private async recarregarAberto(dia?: string): Promise<void> {
    await this.carregar(this.pagina());
    if (this.dias().length === 0 && this.pagina() > 0 && !this.erro()) {
      const anterior = this.pagina() - 1;
      this.pagina.set(anterior);
      this.fecharDias();
      await this.carregar(anterior);
      return;
    }

    if (!dia) {
      const abertos = [...this.abertos()].filter((item) => this.dias().some((linha) => linha.dia === item));
      this.abertos.set(new Set(abertos));
      await Promise.all(abertos.map((item) => this.carregarDia(item)));
      return;
    }

    if (this.dias().some((item) => item.dia === dia)) {
      this.abertos.update((conjunto) => com(conjunto, dia));
      await this.carregarDia(dia);
      return;
    }

    this.abertos.update((conjunto) => sem(conjunto, dia));
  }

  private async carregar(pagina: number): Promise<void> {
    const pedido = ++this.pedido;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.atendimentos.listarDias(pagina);
      if (pedido !== this.pedido) {
        return;
      }
      this.dias.set(resultado.dias);
      this.total.set(resultado.total);
    } catch (erro: unknown) {
      if (pedido !== this.pedido) {
        return;
      }
      this.dias.set([]);
      this.total.set(0);
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      if (pedido === this.pedido) {
        this.carregando.set(false);
      }
    }
  }

  private async carregarDia(dia: string): Promise<void> {
    this.carregandoDia.update((conjunto) => com(conjunto, dia));
    this.errosDia.update((mapa) => {
      const proximo = new Map(mapa);
      proximo.delete(dia);
      return proximo;
    });

    try {
      const registros = await this.atendimentos.listarRegistrosDoDia(dia);
      if (!this.abertos().has(dia)) {
        return;
      }
      this.registros.update((mapa) => new Map(mapa).set(dia, registros));
    } catch (erro: unknown) {
      if (!this.abertos().has(dia)) {
        return;
      }
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';
      this.errosDia.update((mapa) => new Map(mapa).set(dia, mensagem));
      this.registros.update((mapa) => {
        const proximo = new Map(mapa);
        proximo.delete(dia);
        return proximo;
      });
    } finally {
      this.carregandoDia.update((conjunto) => sem(conjunto, dia));
    }
  }

  private fecharDias(): void {
    this.abertos.set(new Set());
    this.registros.set(new Map());
    this.carregandoDia.set(new Set());
    this.errosDia.set(new Map());
  }
}

function com(conjunto: ReadonlySet<string>, dia: string): Set<string> {
  const proximo = new Set(conjunto);
  proximo.add(dia);
  return proximo;
}

function sem(conjunto: ReadonlySet<string>, dia: string): Set<string> {
  const proximo = new Set(conjunto);
  proximo.delete(dia);
  return proximo;
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
