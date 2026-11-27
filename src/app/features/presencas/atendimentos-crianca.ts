import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
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
import { diaLegivel, diasDoCalendario, mesAtual, mesesDisponiveis, rotuloMes, rotuloSituacao, textoFrequencia } from './regras-atendimento';
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
  private readonly destruir = inject(DestroyRef);

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
  readonly rotuloMes = rotuloMes;
  readonly diasSemana = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  readonly modo = signal<'lista' | 'calendario'>('lista');
  readonly mes = signal(mesAtual());
  readonly meses = signal<string[]>([mesAtual()]);
  readonly registrosMes = signal<AtendimentoCrianca[]>([]);
  readonly carregandoMes = signal(false);
  readonly erroMes = signal<string | null>(null);
  readonly grade = computed(() => diasDoCalendario(this.mes()));
  readonly porDia = computed(() => new Map(this.registrosMes().map((item) => [item.dia, item])));
  readonly diaAberto = signal<string | null>(null);
  readonly posicaoCartao = signal<{ top: number; left: number } | null>(null);

  private fecharCartaoTimer: ReturnType<typeof setTimeout> | null = null;

  private pedido = 0;
  private pedidoMes = 0;

  constructor() {
    const fecharAoMover = () => {
      this.cancelarFechamento();
      this.diaAberto.set(null);
    };
    document.addEventListener('scroll', fecharAoMover, true);
    window.addEventListener('resize', fecharAoMover);
    this.destruir.onDestroy(() => {
      this.cancelarFechamento();
      document.removeEventListener('scroll', fecharAoMover, true);
      window.removeEventListener('resize', fecharAoMover);
    });

    effect(() => {
      const id = this.criancaId();
      untracked(() => {
        this.pagina.set(0);
        this.mes.set(mesAtual());
        void this.carregar(id, 0);
        if (this.modo() === 'calendario') {
          void this.carregarCalendario();
        }
      });
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

  trocarModo(modo: 'lista' | 'calendario'): void {
    this.diaAberto.set(null);
    this.modo.set(modo);
    if (modo === 'calendario') {
      void this.carregarCalendario();
    }
  }

  trocarMes(evento: Event): void {
    const alvo = evento.target;
    const valor = alvo instanceof HTMLSelectElement ? alvo.value : '';
    if (!/^\d{4}-\d{2}$/.test(valor) || valor === this.mes()) {
      return;
    }
    this.diaAberto.set(null);
    this.mes.set(valor);
    void this.carregarRegistrosDoMes();
  }

  registroNoDia(iso: string): AtendimentoCrianca | undefined {
    return this.porDia().get(iso);
  }

  mesSemRegistro(): boolean {
    const prefixo = `${this.mes()}-`;
    return !this.registrosMes().some((item) => item.dia.startsWith(prefixo));
  }

  mostrarCartao(evento: Event, iso: string): void {
    this.cancelarFechamento();
    const celula = evento.currentTarget;
    if (!(celula instanceof HTMLElement)) {
      return;
    }

    const caixa = celula.getBoundingClientRect();
    const largura = 224;
    const margem = 8;
    const left = Math.max(margem, Math.min(caixa.left, window.innerWidth - margem - largura));
    const abaixo = caixa.bottom - 6;
    this.diaAberto.set(iso);
    this.posicaoCartao.set({ top: abaixo, left });

    requestAnimationFrame(() => {
      if (this.diaAberto() !== iso) {
        return;
      }
      const cartao = celula.querySelector('.cartao');
      if (!(cartao instanceof HTMLElement)) {
        return;
      }
      const altura = cartao.offsetHeight;
      if (abaixo + altura > window.innerHeight - margem) {
        this.posicaoCartao.set({
          top: Math.max(margem, caixa.top - altura + 6),
          left,
        });
      }
    });
  }

  esconderCartao(evento?: Event): void {
    const destino = evento instanceof MouseEvent || evento instanceof FocusEvent ? evento.relatedTarget : null;
    const celula = evento?.currentTarget;
    if (celula instanceof HTMLElement && destino instanceof Node && celula.contains(destino)) {
      return;
    }
    this.cancelarFechamento();
    this.fecharCartaoTimer = setTimeout(() => this.diaAberto.set(null), 160);
  }

  manterCartao(): void {
    this.cancelarFechamento();
  }

  private cancelarFechamento(): void {
    if (this.fecharCartaoTimer !== null) {
      clearTimeout(this.fecharCartaoTimer);
      this.fecharCartaoTimer = null;
    }
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
      await this.atualizarCalendario();
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
      await this.atualizarCalendario();
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
      await this.atualizarCalendario();
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

  private async atualizarCalendario(): Promise<void> {
    if (this.modo() === 'calendario') {
      await this.carregarCalendario();
    }
  }

  private async carregarCalendario(): Promise<void> {
    const pedido = ++this.pedidoMes;
    this.carregandoMes.set(true);
    this.erroMes.set(null);
    try {
      const dias = await this.atendimentos.listarDiasDaCrianca(this.criancaId());
      if (pedido !== this.pedidoMes) {
        return;
      }
      const meses = mesesDisponiveis(dias);
      this.meses.set(meses);
      if (!meses.includes(this.mes())) {
        this.mes.set(meses[0] ?? mesAtual());
      }
      await this.carregarRegistrosDoMes(pedido);
    } catch (erro: unknown) {
      if (pedido !== this.pedidoMes) {
        return;
      }
      this.registrosMes.set([]);
      this.erroMes.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
      this.carregandoMes.set(false);
    }
  }

  private async carregarRegistrosDoMes(pedido = ++this.pedidoMes): Promise<void> {
    const grade = diasDoCalendario(this.mes());
    const inicio = grade[0]?.iso;
    const fim = grade.at(-1)?.iso;
    if (!inicio || !fim) {
      this.registrosMes.set([]);
      this.carregandoMes.set(false);
      return;
    }

    this.carregandoMes.set(true);
    this.erroMes.set(null);
    try {
      const registros = await this.atendimentos.listarPeriodo(this.criancaId(), inicio, fim);
      if (pedido !== this.pedidoMes) {
        return;
      }
      this.registrosMes.set(registros);
    } catch (erro: unknown) {
      if (pedido !== this.pedidoMes) {
        return;
      }
      this.registrosMes.set([]);
      this.erroMes.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      if (pedido === this.pedidoMes) {
        this.carregandoMes.set(false);
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
