import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { mensagemCadastro, mensagemServidorAusente } from '../criancas/regras-cadastro';

export interface ContagensPainel {
  ativas: number;
  aguardandoValidacao: number;
  documentosEmAnalise: number;
  criancasComPendencia: number;
}

@Injectable({ providedIn: 'root' })
export class PainelServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async contagens(): Promise<ContagensPainel> {
    const cliente = this.cliente();
    const [ativas, aguardandoValidacao, documentosEmAnalise, criancasComPendencia] =
      await Promise.all([
        this.contarCriancas(cliente, 'ativo'),
        this.contarSolicitacoes(cliente),
        this.contarDocumentosAguardando(cliente),
        this.contarCriancasComPendencia(cliente),
      ]);

    return { ativas, aguardandoValidacao, documentosEmAnalise, criancasComPendencia };
  }

  private cliente(): SupabaseClient {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      throw new Error(mensagemServidorAusente());
    }
    return cliente;
  }

  private async contarCriancas(cliente: SupabaseClient, status: string): Promise<number> {
    const { count, error } = await cliente
      .from('criancas')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    return this.total(count, error);
  }

  private async contarSolicitacoes(cliente: SupabaseClient): Promise<number> {
    const { count, error } = await cliente
      .from('solicitacoes_cadastro')
      .select('id', { count: 'exact', head: true })
      .in('status', ['enviado', 'correcao']);
    return this.total(count, error);
  }

  private async contarDocumentosAguardando(cliente: SupabaseClient): Promise<number> {
    const { count, error } = await cliente
      .from('versoes_documento')
      .select('id', { count: 'exact', head: true })
      .eq('atual', true)
      .eq('status', 'pendente');
    return this.total(count, error);
  }

  private async contarCriancasComPendencia(cliente: SupabaseClient): Promise<number> {
    const { count, error } = await cliente
      .from('resumo_documentos')
      .select('crianca_id', { count: 'exact', head: true })
      .gt('pendencias', 0);
    return this.total(count, error);
  }

  private total(count: number | null, error: { code?: string; message?: string } | null): number {
    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }
    return count ?? 0;
  }
}
