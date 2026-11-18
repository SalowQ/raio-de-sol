import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import type { DadosCadastro } from '../../models/cadastro';
import { mensagemServidorAusente } from '../criancas/regras-cadastro';
import { conteudoCompativel } from '../documentos/regras-documento';
import { mensagemLink } from './regras-link';

export interface LinkCriado {
  id: string;
  token: string;
  expira_em: string;
}

export interface SolicitacaoCadastroLista {
  id: string;
  expira_em: string;
  revogado_em: string | null;
  criado_em: string;
  status: string;
  crianca_id: string | null;
  conferir_manualmente: boolean;
  observacao: string | null;
  dados: DadosCadastro | null;
  criancas: { nome: string } | null;
  arquivos_quarentena: { id: string; caminho: string; nome_arquivo: string }[];
  token: string | null;
}

export interface LinkDocumentoLista {
  id: string;
  expira_em: string;
  revogado_em: string | null;
  criado_em: string;
  status: string;
  token: string | null;
}

@Injectable({ providedIn: 'root' })
export class LinksServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async criarCadastro(dias: number): Promise<LinkCriado> {
    return this.rpc<LinkCriado>('criar_link_cadastro', { p_dias: dias });
  }

  async criarDocumentos(criancaId: string, dias: number, tipos: string[]): Promise<LinkCriado> {
    return this.rpc<LinkCriado>('criar_link_documentos', {
      p_crianca: criancaId,
      p_dias: dias,
      p_tipos: tipos,
    });
  }

  async revogar(id: string, finalidade: 'cadastro' | 'documentos'): Promise<void> {
    await this.rpc('revogar_link_familia', { p_id: id, p_finalidade: finalidade });
  }

  async listarCadastros(): Promise<SolicitacaoCadastroLista[]> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('solicitacoes_cadastro')
      .select(
        `id, expira_em, revogado_em, criado_em, status, crianca_id, conferir_manualmente, observacao, dados, token,
         criancas (nome), arquivos_quarentena (id, caminho, nome_arquivo)`,
      )
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(mensagemLink(error.message));
    }

    return ((data ?? []) as unknown[]).map((linha) => normalizarSolicitacao(linha));
  }

  async listarDocumentos(criancaId: string): Promise<LinkDocumentoLista[]> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('solicitacoes_documentos')
      .select('id, expira_em, revogado_em, criado_em, status, token')
      .eq('crianca_id', criancaId)
      .order('criado_em', { ascending: false });

    if (error) {
      throw new Error(mensagemLink(error.message));
    }

    return (data ?? []) as LinkDocumentoLista[];
  }

  async aprovar(id: string): Promise<void> {
    const resultado = await this.rpc<{ arquivos?: { versao_id: string }[] }>(
      'aprovar_solicitacao_cadastro',
      { p_id: id },
    );

    for (const arquivo of resultado.arquivos ?? []) {
      try {
        await this.promover(arquivo.versao_id);
      } catch {
        throw new Error(
          'O cadastro foi ativado, mas um arquivo continuou na quarentena. Aprove o documento no perfil da criança.',
        );
      }
    }
  }

  async pedirCorrecao(id: string, observacao: string): Promise<void> {
    await this.rpc('pedir_correcao_cadastro', { p_id: id, p_observacao: observacao });
  }

  async promover(versaoId: string): Promise<void> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('versoes_documento')
      .select('id, caminho, tipo_mime, documento_id, documentos(crianca_id)')
      .eq('id', versaoId)
      .maybeSingle();

    const linha = data as {
      id: string;
      caminho: string;
      tipo_mime: string;
      documento_id: string;
      documentos: { crianca_id?: string } | { crianca_id?: string }[] | null;
    } | null;

    if (error || !linha?.caminho?.startsWith('quarentena/')) {
      throw new Error(mensagemLink(error?.message ?? 'O arquivo já foi promovido.'));
    }

    const documento = linha.documentos;
    const criancaId = Array.isArray(documento) ? documento[0]?.crianca_id : documento?.crianca_id;
    const extensao =
      linha.tipo_mime === 'application/pdf' ? 'pdf' : linha.tipo_mime === 'image/jpeg' ? 'jpg' : 'png';
    if (!criancaId || !linha.documento_id) {
      throw new Error('Cadastro não encontrado.');
    }

    const destino = `${criancaId}/${linha.documento_id}/${linha.id}.${extensao}`;
    const baixado = await cliente.storage.from('documentos').download(linha.caminho);
    if (baixado.error || !baixado.data) {
      throw new Error(mensagemLink(baixado.error?.message));
    }

    const bytes = new Uint8Array(await baixado.data.arrayBuffer());
    if (!conteudoCompativel(linha.tipo_mime, bytes.subarray(0, 8))) {
      throw new Error('O conteúdo do arquivo não corresponde a PDF, JPEG ou PNG.');
    }

    const envio = await cliente.storage.from('documentos').upload(destino, new Blob([bytes.buffer]), {
      contentType: linha.tipo_mime,
      upsert: false,
    });
    if (envio.error) {
      throw new Error(mensagemLink(envio.error.message));
    }

    try {
      await this.rpc('concluir_promocao_quarentena', { p_versao: versaoId, p_caminho: destino });
    } catch (erro) {
      await cliente.storage.from('documentos').remove([destino]);
      throw erro;
    }

    await cliente.storage.from('documentos').remove([linha.caminho]);
  }

  private cliente(): SupabaseClient {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      throw new Error(mensagemServidorAusente());
    }
    return cliente;
  }

  private async rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.cliente().rpc(nome, args);
    if (error) {
      throw new Error(mensagemLink(error.message));
    }
    return data as T;
  }
}

function normalizarSolicitacao(linha: unknown): SolicitacaoCadastroLista {
  const item = linha as SolicitacaoCadastroLista & {
    criancas?: { nome: string } | { nome: string }[] | null;
  };
  const crianca = Array.isArray(item.criancas) ? (item.criancas[0] ?? null) : (item.criancas ?? null);
  return {
    ...item,
    criancas: crianca,
    arquivos_quarentena: item.arquivos_quarentena ?? [],
    token: item.token ?? null,
  };
}
