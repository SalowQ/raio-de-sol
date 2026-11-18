import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { LinksServico, type CadastroDoLink, type LinkCadastroLista } from '../familia/links-servico';
import { rotuloBeneficio } from '../criancas/regras-cadastro';
import {
  enderecoLinkAtivo,
  rotuloSolicitacao,
  urlDoLink,
  VALIDADE_SUGERIDA_DIAS,
  validarValidadeDias,
} from '../familia/regras-link';

@Component({
  selector: 'app-cadastros-pendentes',
  imports: [DatePipe, RouterLink, MatButtonModule, Carregando, EstadoErro, EstadoVazio],
  templateUrl: './cadastros-pendentes.html',
  styleUrl: './cadastros-pendentes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadastrosPendentes implements OnInit {
  private readonly links = inject(LinksServico);

  readonly carregando = signal(true);
  readonly gerando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly dias = signal(VALIDADE_SUGERIDA_DIAS);
  readonly linkGerado = signal<string | null>(null);
  readonly itens = signal<LinkCadastroLista[]>([]);
  readonly abertos = signal<ReadonlySet<string>>(new Set());
  readonly rotulo = rotuloSolicitacao;
  readonly rotuloBeneficio = rotuloBeneficio;

  ngOnInit(): void {
    void this.carregar();
  }

  aoDigitarDias(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.dias.set(Number.isNaN(valor) ? 0 : valor);
  }

  aberto(id: string): boolean {
    return this.abertos().has(id);
  }

  alternar(id: string): void {
    this.abertos.update((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  resumoCadastros(item: LinkCadastroLista): string {
    const quantidade = item.cadastros.length;
    if (quantidade === 0) {
      return 'Nenhum cadastro';
    }
    return quantidade === 1 ? '1 cadastro' : `${quantidade} cadastros`;
  }

  rotuloLink(item: LinkCadastroLista): string {
    if (item.revogado_em) {
      return 'Revogado';
    }
    if (new Date(item.expira_em).getTime() <= Date.now()) {
      return 'Expirado';
    }
    return 'Aberto';
  }

  arquivos(item: CadastroDoLink): number {
    return item.arquivos_quarentena?.length ?? 0;
  }

  nome(item: CadastroDoLink): string {
    const crianca = item.criancas as { nome?: string } | { nome?: string }[] | null;
    const ligado = Array.isArray(crianca) ? crianca[0]?.nome : crianca?.nome;
    if (ligado) {
      return ligado;
    }
    return item.dados?.crianca.nome || 'Envio sem cadastro';
  }

  endereco(item: LinkCadastroLista): string | null {
    return enderecoLinkAtivo(
      location.origin,
      'cadastro',
      {
        token: item.token,
        expiraEm: item.expira_em,
        revogadoEm: item.revogado_em,
        status: 'aberto',
      },
      new Date(),
    );
  }

  async gerar(): Promise<void> {
    const invalido = validarValidadeDias(this.dias());
    if (invalido) {
      this.erro.set(invalido);
      return;
    }

    this.gerando.set(true);
    this.erro.set(null);
    try {
      const criado = await this.links.criarCadastro(this.dias());
      this.linkGerado.set(urlDoLink(location.origin, 'cadastro', criado.token));
      this.abertos.update((atual) => new Set(atual).add(criado.id));
      await this.carregar();
    } catch (erro: unknown) {
      this.erro.set(texto(erro));
    } finally {
      this.gerando.set(false);
    }
  }

  async copiar(link: string): Promise<void> {
    await navigator.clipboard.writeText(link);
  }

  async aprovar(id: string): Promise<void> {
    this.erro.set(null);
    try {
      await this.links.aprovar(id);
      await this.carregar();
    } catch (erro: unknown) {
      this.erro.set(texto(erro));
      await this.carregar(true);
    }
  }

  async revogar(id: string): Promise<void> {
    this.erro.set(null);
    try {
      await this.links.revogar(id, 'cadastro');
      await this.carregar();
    } catch (erro: unknown) {
      this.erro.set(texto(erro));
    }
  }

  private async carregar(preservarErro = false): Promise<void> {
    this.carregando.set(true);
    try {
      this.itens.set(await this.links.listarCadastros());
      if (!preservarErro) {
        this.erro.set(null);
      }
    } catch (erro: unknown) {
      this.erro.set(texto(erro));
    } finally {
      this.carregando.set(false);
    }
  }
}

function texto(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';
}
