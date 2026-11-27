import { Injectable } from '@angular/core';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { TAMANHO_PAGINA } from '../criancas/paginacao';
import { mensagemCadastro, mensagemServidorAusente } from '../criancas/regras-cadastro';
import {
  mensagemAtendimento,
  ordenarAtendimentosRecentes,
  type SituacaoAtendimento,
} from './regras-atendimento';

export interface AtendimentoCrianca {
  id: string;
  dia: string;
  situacao: SituacaoAtendimento;
  anotacao: string | null;
}

export interface PaginaAtendimentos {
  itens: AtendimentoCrianca[];
  total: number;
  presentes: number;
  faltas: number;
}

export interface DiaAtendimento {
  dia: string;
  quantidade: number;
}

export interface PaginaDias {
  dias: DiaAtendimento[];
  total: number;
}

export interface RegistroDoDia {
  id: string;
  nome: string;
  situacao: SituacaoAtendimento;
  anotacao: string | null;
}

export interface CriancaAtiva {
  id: string;
  nome: string;
}

@Injectable({ providedIn: 'root' })
export class AtendimentoServico {
  constructor(private readonly supabase: SupabaseCliente) {}

  async listarDias(pagina: number): Promise<PaginaDias> {
    const cliente = this.cliente();
    const tamanho = TAMANHO_PAGINA || 10;
    const inicio = Math.max(pagina, 0) * tamanho;
    const { data, error, count } = await cliente
      .from('dias_atendimento')
      .select('dia, quantidade', { count: 'exact' })
      .order('dia', { ascending: false })
      .range(inicio, inicio + tamanho - 1);

    if (error) {
      throw new Error(mensagemAtendimento(error.message));
    }

    return {
      dias: ((data ?? []) as { dia: string; quantidade: number }[]).map((item) => ({
        dia: item.dia,
        quantidade: item.quantidade,
      })),
      total: count ?? 0,
    };
  }

  async listarRegistrosDoDia(dia: string): Promise<RegistroDoDia[]> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('atendimentos')
      .select('id, situacao, anotacao, criancas(nome)')
      .eq('dia', dia)
      .eq('sessao', 'dia');

    if (error) {
      throw new Error(mensagemAtendimento(error.message));
    }

    const registros = (
      (data ?? []) as {
        id: string;
        situacao: string;
        anotacao: string | null;
        criancas: { nome?: string } | { nome?: string }[] | null;
      }[]
    )
      .filter((item) => item.situacao === 'presente' || item.situacao === 'falta')
      .map((item) => ({
        id: item.id,
        nome: nomeDaCrianca(item.criancas),
        situacao: item.situacao as SituacaoAtendimento,
        anotacao: item.anotacao,
      }));

    return registros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async listarCriancasAtivas(): Promise<CriancaAtiva[]> {
    const cliente = this.cliente();
    const { data, error } = await cliente
      .from('criancas')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome', { ascending: true });

    if (error) {
      throw new Error(mensagemCadastro(error.code, error.message));
    }

    return ((data ?? []) as { id: string; nome: string }[]).map((item) => ({
      id: item.id,
      nome: item.nome,
    }));
  }

  async registrar(
    criancaId: string,
    dia: string,
    situacao: SituacaoAtendimento,
    anotacao: string | null,
  ): Promise<string> {
    const cliente = this.cliente();
    const { data, error } = await cliente.rpc('registrar_atendimento', {
      p_crianca: criancaId,
      p_dia: dia,
      p_situacao: situacao,
      p_anotacao: anotacao,
    });

    if (error) {
      throw new Error(mensagemAtendimento(error.message));
    }

    return data as string;
  }

  async atualizar(
    id: string,
    dia: string,
    situacao: SituacaoAtendimento,
    anotacao: string | null,
  ): Promise<void> {
    const cliente = this.cliente();
    const { error } = await cliente.rpc('atualizar_atendimento', {
      p_id: id,
      p_dia: dia,
      p_situacao: situacao,
      p_anotacao: anotacao,
    });

    if (error) {
      throw new Error(mensagemAtendimento(error.message));
    }
  }

  async excluir(id: string): Promise<void> {
    const cliente = this.cliente();
    const { error } = await cliente.rpc('excluir_atendimento', { p_id: id });

    if (error) {
      throw new Error(mensagemAtendimento(error.message));
    }
  }

  async listarDaCrianca(criancaId: string, pagina: number): Promise<PaginaAtendimentos> {
    const cliente = this.cliente();
    const tamanho = TAMANHO_PAGINA || 10;
    const inicio = Math.max(pagina, 0) * tamanho;
    const filtro = () =>
      cliente.from('atendimentos').select('id', { count: 'exact', head: true }).eq('crianca_id', criancaId).eq('sessao', 'dia');

    const [lista, presentes, faltas] = await Promise.all([
      cliente
        .from('atendimentos')
        .select('id, dia, situacao, anotacao', { count: 'exact' })
        .eq('crianca_id', criancaId)
        .eq('sessao', 'dia')
        .order('dia', { ascending: false })
        .range(inicio, inicio + tamanho - 1),
      filtro().eq('situacao', 'presente'),
      filtro().eq('situacao', 'falta'),
    ]);

    if (lista.error || presentes.error || faltas.error) {
      throw new Error(mensagemAtendimento(lista.error?.message ?? presentes.error?.message ?? faltas.error?.message));
    }

    const itens = ordenarAtendimentosRecentes(
      ((lista.data ?? []) as { id: string; dia: string; situacao: string; anotacao: string | null }[])
        .filter((item) => item.situacao === 'presente' || item.situacao === 'falta')
        .map((item) => ({
          id: item.id,
          dia: item.dia,
          situacao: item.situacao as SituacaoAtendimento,
          anotacao: item.anotacao,
        })),
    );

    return {
      itens,
      total: lista.count ?? 0,
      presentes: presentes.count ?? 0,
      faltas: faltas.count ?? 0,
    };
  }

  private cliente() {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      throw new Error(mensagemServidorAusente());
    }
    return cliente;
  }
}

function nomeDaCrianca(valor: { nome?: string } | { nome?: string }[] | null): string {
  const item = Array.isArray(valor) ? valor[0] : valor;
  return item?.nome?.trim() || 'Criança';
}
