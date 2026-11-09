import { Injectable } from '@angular/core';
import type { BeneficioCatalogo, CriancaResumo, DadosCadastro, PaginaCriancas, StatusCrianca } from '../../models/cadastro';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { mapearPerfil } from './mapear-perfil';
import { TAMANHO_PAGINA } from './paginacao';
import { mensagemCadastro, mensagemServidorAusente, termoDeBusca } from './regras-cadastro';

export interface FiltroCriancas {
  nome: string;
  status: StatusCrianca | '';
  pagina: number;
}

@Injectable({ providedIn: 'root' })
export class CadastroServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async listar(filtro: FiltroCriancas): Promise<PaginaCriancas> {
    const cliente = this.cliente();
    const tamanho = TAMANHO_PAGINA || 10;
    const inicio = filtro.pagina * tamanho;
    let consulta = cliente
      .from('criancas')
      .select('id, nome, status, recebe_beneficio', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(inicio, inicio + tamanho - 1);

    const termo = termoDeBusca(filtro.nome);
    if (termo) {
      consulta = consulta.ilike('nome', `%${termo}%`);
    }

    if (filtro.status) {
      consulta = consulta.eq('status', filtro.status);
    }

    const { data, error, count } = await consulta;
    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }

    return {
      itens: (data ?? []) as CriancaResumo[],
      total: count ?? 0,
    };
  }

  async listarBeneficios(): Promise<BeneficioCatalogo[]> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('beneficios')
      .select('id, codigo, nome, ativo, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }

    return (data ?? []) as BeneficioCatalogo[];
  }

  async obter(id: string) {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('criancas')
      .select(
        `id, nome, rg, orgao_emissor_rg, cpf, data_nascimento, data_ingresso, status, recebe_beneficio, observacoes,
         crianca_responsaveis (
           parentesco, principal,
           responsaveis (id, nome, rg, orgao_emissor_rg, cpf, email, telefone, contato)
         ),
         crianca_beneficios (beneficio_id)`,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }

    if (!data) {
      return null;
    }

    return mapearPerfil(data as Record<string, unknown>);
  }

  async cadastrar(dados: DadosCadastro): Promise<string> {
    const cliente = this.cliente();
    const { data, error } = await cliente.rpc('cadastrar_crianca', { dados });
    if (error || typeof data !== 'string') {
      throw new Error(mensagemCadastro(error?.code, error?.message));
    }

    return data;
  }

  async atualizar(id: string, dados: DadosCadastro): Promise<void> {
    const cliente = this.cliente();
    const { error } = await cliente.rpc('atualizar_cadastro', { alvo: id, dados });
    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }
  }

  private cliente() {
    if (!this.supabase.cliente) {
      throw new Error(mensagemServidorAusente());
    }

    return this.supabase.cliente;
  }
}
