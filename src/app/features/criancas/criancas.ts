import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MAT_PAGINATOR_DEFAULT_OPTIONS,
  MatPaginatorIntl,
  MatPaginatorModule,
  type PageEvent,
} from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import type { CriancaResumo, StatusCrianca } from '../../models/cadastro';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { CadastroServico } from './cadastro-servico';
import { rotuloPaginacao, TAMANHO_PAGINA } from './paginacao';
import { rotuloQuantidadeDocumentos } from '../documentos/regras-documento';
import { rotuloBeneficio, rotuloStatus, STATUS_CRIANCA } from './regras-cadastro';

@Component({
  selector: 'app-criancas',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    Carregando,
    EstadoErro,
    EstadoVazio,
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: paginadorPortugues },
    {
      provide: MAT_PAGINATOR_DEFAULT_OPTIONS,
      useValue: { pageSize: TAMANHO_PAGINA || 10, hidePageSize: true },
    },
  ],
  templateUrl: './criancas.html',
  styleUrl: './criancas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Criancas implements OnInit {
  private readonly cadastro = inject(CadastroServico);
  private readonly rota = inject(ActivatedRoute);

  readonly statusOpcoes = STATUS_CRIANCA;
  // O pacote de testes pode ler a constante antes dela existir. O tamanho real continua 10.
  readonly tamanhoPagina = TAMANHO_PAGINA || 10;
  readonly nome = new FormControl('', { nonNullable: true });
  readonly status = new FormControl<StatusCrianca | ''>(
    situacaoInicial(this.rota.snapshot.queryParamMap.get('situacao')),
    { nonNullable: true },
  );
  readonly itens = signal<CriancaResumo[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly rotuloStatus = rotuloStatus;
  readonly rotuloBeneficio = rotuloBeneficio;
  readonly rotuloDocumentos = (crianca: CriancaResumo) =>
    rotuloQuantidadeDocumentos(crianca.documentos_enviados, crianca.documentos_total);

  ngOnInit(): void {
    void this.buscar();
  }

  async buscar(pagina = 0): Promise<void> {
    this.pagina.set(pagina);
    this.carregando.set(true);
    this.erro.set(null);

    try {
      const resultado = await this.cadastro.listar({
        nome: this.nome.value,
        status: this.status.value,
        pagina,
      });
      this.itens.set(resultado.itens);
      this.total.set(resultado.total);
    } catch (erro: unknown) {
      this.itens.set([]);
      this.total.set(0);
      this.erro.set(textoDoErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  mudarPagina(evento: PageEvent): void {
    void this.buscar(evento.pageIndex);
  }

  resumoPagina(): string {
    return rotuloPaginacao(this.pagina(), this.tamanhoPagina, this.total());
  }
}

export function situacaoInicial(valor: string | null): StatusCrianca | '' {
  if (valor === 'ativo' || valor === 'pendente_validacao' || valor === 'inativo') {
    return valor;
  }
  if (valor === 'todas') {
    return '';
  }
  return 'ativo';
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error
    ? erro.message
    : 'Não foi possível concluir a operação. Tente novamente.';
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
