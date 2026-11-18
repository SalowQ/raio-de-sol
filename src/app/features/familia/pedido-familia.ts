import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ItemChecklist } from '../../models/documento';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { LinksServico, type LinkDocumentoLista } from './links-servico';
import {
  enderecoLinkAtivo,
  rotuloSolicitacao,
  urlDoLink,
  VALIDADE_SUGERIDA_DIAS,
  validarValidadeDias,
} from './regras-link';

@Component({
  selector: 'app-pedido-familia',
  imports: [MatButtonModule, EstadoErro],
  templateUrl: './pedido-familia.html',
  styleUrl: './pedido-familia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PedidoFamilia {
  private readonly links = inject(LinksServico);

  readonly criancaId = input.required<string>();
  readonly itens = input<ItemChecklist[]>([]);
  readonly dias = signal(VALIDADE_SUGERIDA_DIAS);
  readonly marcados = signal<ReadonlySet<string>>(new Set());
  readonly linksAbertos = signal<LinkDocumentoLista[]>([]);
  readonly gerado = signal<string | null>(null);
  readonly erro = signal<string | null>(null);
  readonly gerando = signal(false);
  readonly rotulo = rotuloSolicitacao;

  constructor() {
    effect(() => {
      const pendentes = this.itens().filter((item) => !item.aprovado).map((item) => item.tipo.id);
      this.marcados.set(new Set(pendentes));
    });

    effect(() => {
      void this.carregar(this.criancaId());
    });
  }

  aoDigitarDias(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.dias.set(Number.isNaN(valor) ? 0 : valor);
  }

  marcado(id: string): boolean {
    return this.marcados().has(id);
  }

  alternarEvento(id: string, evento: Event): void {
    this.alternar(id, (evento.target as HTMLInputElement).checked);
  }

  alternar(id: string, ligado: boolean): void {
    this.marcados.update((atual) => {
      const proximo = new Set(atual);
      if (ligado) {
        proximo.add(id);
      } else {
        proximo.delete(id);
      }
      return proximo;
    });
  }

  endereco(link: LinkDocumentoLista): string | null {
    return enderecoLinkAtivo(
      location.origin,
      'documentos',
      {
        token: link.token,
        expiraEm: link.expira_em,
        revogadoEm: link.revogado_em,
        status: link.status,
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
    if (this.marcados().size === 0) {
      this.erro.set('Selecione ao menos um tipo de documento.');
      return;
    }

    this.gerando.set(true);
    this.erro.set(null);
    try {
      const criado = await this.links.criarDocumentos(this.criancaId(), this.dias(), [...this.marcados()]);
      this.gerado.set(urlDoLink(location.origin, 'documentos', criado.token));
      await this.carregar(this.criancaId());
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      this.gerando.set(false);
    }
  }

  async copiar(link: string): Promise<void> {
    await navigator.clipboard.writeText(link);
  }

  async revogar(id: string): Promise<void> {
    this.erro.set(null);
    try {
      await this.links.revogar(id, 'documentos');
      await this.carregar(this.criancaId());
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    }
  }

  private async carregar(criancaId: string): Promise<void> {
    try {
      this.linksAbertos.set(await this.links.listarDocumentos(criancaId));
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    }
  }
}
