import { Injectable } from '@angular/core';
import type {
  DocumentoCrianca,
  ItemChecklist,
  ReservaVersao,
  StatusDocumento,
  TipoDocumento,
  VersaoDocumento,
} from '../../models/documento';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { mensagemServidorAusente } from '../criancas/regras-cadastro';
import { conteudoCompativel, mensagemDocumento, montarChecklist, validarArquivo } from './regras-documento';

const DURACAO_URL = 60;

@Injectable({ providedIn: 'root' })
export class DocumentoServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async listarTipos(): Promise<TipoDocumento[]> {
    return this.tipos(this.cliente());
  }

  async checklist(criancaId: string): Promise<ItemChecklist[]> {
    const cliente = this.cliente();
    const [tipos, documentos] = await Promise.all([
      this.tipos(cliente),
      this.documentosDaCrianca(cliente, criancaId),
    ]);
    return montarChecklist(tipos, documentos);
  }

  async enviar(criancaId: string, tipoId: string, arquivo: File): Promise<void> {
    const invalido = validarArquivo(arquivo);
    if (invalido) {
      throw new Error(invalido);
    }

    const bytes = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
    if (!conteudoCompativel(arquivo.type, bytes)) {
      throw new Error('O conteúdo do arquivo não corresponde a PDF, JPEG ou PNG.');
    }

    const cliente = this.cliente();
    const { data, error } = await cliente.rpc('registrar_versao_documento', {
      p_crianca: criancaId,
      p_tipo: tipoId,
      p_nome: arquivo.name,
      p_mime: arquivo.type,
      p_tamanho: arquivo.size,
    });

    if (error) {
      throw new Error(mensagemDocumento(error.message));
    }

    const reserva = data as ReservaVersao;
    const envio = await cliente.storage.from('documentos').upload(reserva.caminho, arquivo, {
      contentType: arquivo.type,
      upsert: false,
    });

    if (envio.error) {
      await cliente.rpc('desfazer_envio_documento', { p_versao: reserva.versao_id });
      throw new Error(mensagemDocumento(envio.error.message));
    }
  }

  async abrir(caminho: string): Promise<string> {
    const cliente = this.cliente();
    const { data, error } = await cliente.storage
      .from('documentos')
      .createSignedUrl(caminho, DURACAO_URL);

    if (error || !data?.signedUrl) {
      throw new Error(mensagemDocumento(error?.message));
    }

    return data.signedUrl;
  }

  async definirStatus(
    versaoId: string,
    status: Exclude<StatusDocumento, 'pendente'>,
    observacao: string | null,
  ): Promise<void> {
    const cliente = this.cliente();
    const { error } = await cliente.rpc('definir_status_documento', {
      p_versao: versaoId,
      p_status: status,
      p_observacao: observacao,
    });

    if (error) {
      throw new Error(mensagemDocumento(error.message));
    }
  }

  private async tipos(cliente: NonNullable<SupabaseCliente['cliente']>): Promise<TipoDocumento[]> {
    const { data, error } = await cliente
      .from('tipos_documento')
      .select('id, codigo, nome, obrigatorio, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      throw new Error(mensagemDocumento(error.message));
    }

    return (data ?? []) as TipoDocumento[];
  }

  private async documentosDaCrianca(
    cliente: NonNullable<SupabaseCliente['cliente']>,
    criancaId: string,
  ): Promise<DocumentoCrianca[]> {
    const { data, error } = await cliente
      .from('documentos')
      .select(
        `id, tipo_id,
         versoes_documento (
           id, numero, status, caminho, nome_arquivo, tipo_mime, tamanho_bytes, observacao, criado_em, atual
         )`,
      )
      .eq('crianca_id', criancaId);

    if (error) {
      throw new Error(mensagemDocumento(error.message));
    }

    return (data ?? []).map((linha) => {
      const registro = linha as {
        id: string;
        tipo_id: string;
        versoes_documento: VersaoDocumento[] | null;
      };
      return {
        id: registro.id,
        tipo_id: registro.tipo_id,
        versoes: registro.versoes_documento ?? [],
      };
    });
  }

  private cliente(): NonNullable<SupabaseCliente['cliente']> {
    if (!this.supabase.cliente) {
      throw new Error(mensagemServidorAusente());
    }

    return this.supabase.cliente;
  }
}
