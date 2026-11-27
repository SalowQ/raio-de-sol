export type SituacaoAtendimento = 'presente' | 'falta';

export const LIMITE_ANOTACAO = 1000;

export interface LinhaDia {
  criancaId: string;
  nome: string;
  situacao: SituacaoAtendimento | null;
  anotacao: string;
  salvando: boolean;
  aviso: string | null;
  atendimentoId: string | null;
}

export interface TotaisDia {
  presentes: number;
  faltas: number;
  semRegistro: number;
}

const MENSAGENS = [
  'Operação não autorizada.',
  'Informe o dia do atendimento.',
  'Marque presença ou falta.',
  'A anotação pode ter até 1000 caracteres.',
  'Cadastro não encontrado.',
  'Este dia já tem registro.',
];

export function diaLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function dataDoDia(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map((parte) => Number(parte));
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

export function diaLegivel(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) {
    return iso;
  }
  return `${dia}/${mes}/${ano}`;
}

export function situacaoConhecida(valor: string | null): SituacaoAtendimento | null {
  return valor === 'presente' || valor === 'falta' ? valor : null;
}

export function rotuloSituacao(situacao: SituacaoAtendimento | null): string {
  if (situacao === 'presente') {
    return 'Presente';
  }
  if (situacao === 'falta') {
    return 'Falta';
  }
  return 'Sem registro';
}

export function anotacaoOuNula(valor: string): string | null {
  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

export function validarRegistro(situacao: SituacaoAtendimento | null, anotacao: string): string | null {
  if (!situacao) {
    return 'Marque presença ou falta.';
  }
  if (anotacao.trim().length > LIMITE_ANOTACAO) {
    return 'A anotação pode ter até 1000 caracteres.';
  }
  return null;
}

export function montarLinhas(
  criancas: { id: string; nome: string }[],
  registros: { id?: string; crianca_id: string; situacao: string; anotacao: string | null }[],
): LinhaDia[] {
  const porCrianca = new Map(registros.map((item) => [item.crianca_id, item]));
  return criancas.map((crianca) => {
    const registro = porCrianca.get(crianca.id);
    return {
      criancaId: crianca.id,
      nome: crianca.nome,
      situacao: situacaoConhecida(registro?.situacao ?? null),
      anotacao: registro?.anotacao ?? '',
      salvando: false,
      aviso: null,
      atendimentoId: registro?.id ?? null,
    };
  });
}

export function filtrarPorNome(linhas: readonly LinhaDia[], termo: string): LinhaDia[] {
  const busca = termo.trim().toLocaleLowerCase('pt-BR');
  if (!busca) {
    return [...linhas];
  }
  return linhas.filter((item) => item.nome.toLocaleLowerCase('pt-BR').includes(busca));
}

export function totaisDoDia(linhas: readonly { situacao: SituacaoAtendimento | null }[]): TotaisDia {
  const totais = { presentes: 0, faltas: 0, semRegistro: 0 };
  for (const linha of linhas) {
    if (linha.situacao === 'presente') {
      totais.presentes += 1;
    } else if (linha.situacao === 'falta') {
      totais.faltas += 1;
    } else {
      totais.semRegistro += 1;
    }
  }
  return totais;
}

export function textoTotaisDia(totais: TotaisDia): string {
  return `${quantidade(totais.presentes, 'presença', 'presenças')}, ${quantidade(totais.faltas, 'falta', 'faltas')}, ${quantidade(totais.semRegistro, 'sem registro', 'sem registro')}`;
}

/** O dia mais novo fica primeiro. A data ISO ordena como texto. */
export function ordenarAtendimentosRecentes<T extends { dia: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => b.dia.localeCompare(a.dia));
}

export function textoQuantidadeRegistros(valor: number): string {
  return `${valor} ${valor === 1 ? 'registro' : 'registros'}`;
}

export function textoFrequencia(presentes: number, faltas: number): string {
  return `${quantidade(presentes, 'presença', 'presenças')} e ${quantidade(faltas, 'falta', 'faltas')}.`;
}

export function mensagemAtendimento(texto: string | undefined): string {
  if (texto?.includes('dias_atendimento')) {
    return 'Aplique o SQL novo da lista de dias de atendimento no Supabase e tente de novo.';
  }

  if (
    texto?.includes('atendimentos') ||
    texto?.includes('registrar_atendimento') ||
    texto?.includes('atualizar_atendimento') ||
    texto?.includes('excluir_atendimento') ||
    texto?.includes('schema cache')
  ) {
    return 'Aplique o SQL novo do registro diário de atendimento no Supabase e tente de novo.';
  }

  const conhecida = MENSAGENS.find((item) => texto?.includes(item));
  if (conhecida) {
    return conhecida;
  }

  return 'Não foi possível concluir a operação. Tente novamente.';
}

function quantidade(valor: number, um: string, varios: string): string {
  return `${valor} ${valor === 1 ? um : varios}`;
}
