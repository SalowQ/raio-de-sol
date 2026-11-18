import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ItemChecklist, StatusDocumento } from '../../models/documento';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { DocumentoServico } from './documento-servico';
import { formatarQuando, rotuloVersao, versoesRecentes } from './regras-documento';
import { LinksServico } from '../familia/links-servico';

@Component({
  selector: 'app-checklist-crianca',
  imports: [MatButtonModule, Carregando, EstadoErro],
  templateUrl: './checklist-crianca.html',
  styleUrl: './checklist-crianca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistCrianca {
  private readonly documentos = inject(DocumentoServico);
  private readonly links = inject(LinksServico);

  readonly criancaId = input.required<string>();
  readonly itens = signal<ItemChecklist[]>([]);
  readonly carregando = signal(true);
  readonly enviando = signal<string | null>(null);
  readonly erro = signal<string | null>(null);
  readonly abertas = signal<ReadonlySet<string>>(new Set());
  readonly rejeitando = signal<string | null>(null);
  readonly observacao = signal('');
  readonly rotuloVersao = rotuloVersao;
  readonly formatarQuando = formatarQuando;
  readonly versoesRecentes = versoesRecentes;

  constructor() {
    effect(() => {
      void this.carregar(this.criancaId());
    });
  }

  quantidade(item: ItemChecklist): number {
    return item.documento?.versoes.length ?? 0;
  }

  alternarVersoes(tipoId: string): void {
    this.abertas.update((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(tipoId)) {
        proximo.delete(tipoId);
      } else {
        proximo.add(tipoId);
      }
      return proximo;
    });
  }

  async escolherArquivo(item: ItemChecklist, evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (!arquivo) {
      return;
    }

    this.enviando.set(item.tipo.id);
    this.erro.set(null);
    try {
      await this.documentos.enviar(this.criancaId(), item.tipo.id, arquivo);
      await this.carregar(this.criancaId());
    } catch (erro: unknown) {
      this.erro.set(textoDoErro(erro));
    } finally {
      this.enviando.set(null);
    }
  }

  async abrir(caminho: string): Promise<void> {
    this.erro.set(null);
    try {
      const url = await this.documentos.abrir(caminho);
      window.open(url, '_blank', 'noopener');
    } catch (erro: unknown) {
      this.erro.set(textoDoErro(erro));
    }
  }

  iniciarRejeicao(versaoId: string): void {
    this.rejeitando.set(versaoId);
    this.observacao.set('');
  }

  aoDigitarObservacao(evento: Event): void {
    this.observacao.set((evento.target as HTMLTextAreaElement).value);
  }

  cancelarRejeicao(): void {
    this.rejeitando.set(null);
    this.observacao.set('');
  }

  async definirStatus(
    versaoId: string,
    status: Exclude<StatusDocumento, 'pendente'>,
  ): Promise<void> {
    this.erro.set(null);
    try {
      const versao = this.versaoPorId(versaoId);
      if (status === 'aprovado' && versao?.caminho.startsWith('quarentena/')) {
        await this.links.promover(versaoId);
      } else {
        await this.documentos.definirStatus(
          versaoId,
          status,
          status === 'rejeitado' ? this.observacao() : null,
        );
      }
      this.cancelarRejeicao();
      await this.carregar(this.criancaId());
    } catch (erro: unknown) {
      this.erro.set(textoDoErro(erro));
    }
  }

  private versaoPorId(id: string) {
    for (const item of this.itens()) {
      const versao = item.documento?.versoes.find((candidata) => candidata.id === id);
      if (versao) {
        return versao;
      }
    }
    return null;
  }

  private async carregar(criancaId: string): Promise<void> {
    this.carregando.set(true);
    try {
      this.itens.set(await this.documentos.checklist(criancaId));
      this.erro.set(null);
    } catch (erro: unknown) {
      this.itens.set([]);
      this.erro.set(textoDoErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error
    ? erro.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}
