import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import type { DadosCadastro } from '../../models/cadastro';
import { mensagemServidorAusente } from '../criancas/regras-cadastro';
import { conteudoCompativel, validarArquivo } from '../documentos/regras-documento';
import { mensagemLink, respostaConsultaPublica } from './regras-link';

export interface TipoLink {
  id: string;
  nome: string;
  ordem: number;
}

export interface BeneficioLink {
  id: string;
  codigo: string;
  nome: string;
}

export interface ConsultaLink {
  valido: boolean;
  mensagem?: string;
  finalidade?: 'cadastro' | 'documentos';
  status?: string;
  observacao?: string | null;
  dados?: DadosCadastro | null;
  tipos?: TipoLink[];
  beneficios?: BeneficioLink[];
}

@Injectable({ providedIn: 'root' })
export class FamiliaServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async consultar(token: string): Promise<ConsultaLink> {
    const { data, error } = await this.cliente().rpc('descrever_link_familia', { p_token: token });
    if (error) {
      throw new Error(mensagemLink(error.message));
    }
    return respostaConsultaPublica((data ?? {}) as Record<string, unknown>) as unknown as ConsultaLink;
  }

  async enviarCadastro(token: string, dados: DadosCadastro): Promise<{ mensagem: string; solicitacaoId: string | null }> {
    const { data, error } = await this.cliente().rpc('receber_cadastro_familia', {
      p_token: token,
      p_dados: dados,
    });
    if (error) {
      throw new Error(mensagemLink(error.message));
    }
    const corpo = (data ?? {}) as { solicitacao_id?: string };
    return {
      mensagem: 'Recebemos o envio. A equipe do Instituto vai conferir.',
      solicitacaoId: corpo.solicitacao_id ?? null,
    };
  }

  async enviarArquivo(
    token: string,
    finalidade: 'cadastro' | 'documentos',
    tipoId: string,
    arquivo: File,
    solicitacaoId: string | null = null,
  ): Promise<void> {
    const invalido = validarArquivo(arquivo);
    if (invalido) {
      throw new Error(invalido);
    }

    const bytes = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
    if (!conteudoCompativel(arquivo.type, bytes)) {
      throw new Error('O conteúdo do arquivo não corresponde a PDF, JPEG ou PNG.');
    }

    if (finalidade === 'cadastro' && !solicitacaoId) {
      throw new Error('Aplique o SQL novo do envio de arquivos da família no Supabase e tente de novo.');
    }

    const cliente = this.cliente();
    const { data, error } = await cliente.rpc('reservar_arquivo_familia', {
      p_token: token,
      p_finalidade: finalidade,
      p_tipo: tipoId,
      p_mime: arquivo.type,
      p_solicitacao: solicitacaoId,
    });
    const caminho = (data as { caminho?: string } | null)?.caminho;
    if (error || !caminho) {
      throw new Error(mensagemLink(error?.message));
    }

    const envio = await cliente.storage.from('documentos').upload(caminho, arquivo, {
      contentType: arquivo.type,
      upsert: false,
    });
    if (envio.error) {
      throw new Error(mensagemLink(envio.error.message));
    }

    const confirmacao = await cliente.rpc('confirmar_arquivo_familia', {
      p_token: token,
      p_finalidade: finalidade,
      p_tipo: tipoId,
      p_caminho: caminho,
      p_nome: arquivo.name,
      p_mime: arquivo.type,
      p_tamanho: arquivo.size,
      p_solicitacao: solicitacaoId,
    });
    if (confirmacao.error) {
      throw new Error(mensagemLink(confirmacao.error.message));
    }
  }

  private cliente(): SupabaseClient {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      throw new Error(mensagemServidorAusente());
    }
    return cliente;
  }

}
