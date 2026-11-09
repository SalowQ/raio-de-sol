import type { CriancaPerfil, ResponsavelCadastro, SituacaoBeneficio, StatusCrianca } from '../../models/cadastro';

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : null;
}

function status(valor: unknown): StatusCrianca {
  if (valor === 'pendente_validacao' || valor === 'ativo' || valor === 'inativo') {
    return valor;
  }

  return 'ativo';
}

function situacao(valor: unknown): SituacaoBeneficio {
  if (valor === 'nao_recebe' || valor === 'recebe' || valor === 'nao_informado') {
    return valor;
  }

  return 'nao_informado';
}

function registro(valor: unknown): Record<string, unknown> | null {
  if (Array.isArray(valor)) {
    return registro(valor[0]);
  }

  if (!valor || typeof valor !== 'object') {
    return null;
  }

  return valor as Record<string, unknown>;
}

function responsavelDaLigacao(ligacao: Record<string, unknown>): ResponsavelCadastro | null {
  const pessoa = registro(ligacao['responsaveis']);
  if (!pessoa || typeof pessoa['id'] !== 'string' || typeof pessoa['nome'] !== 'string') {
    return null;
  }

  return {
    id: pessoa['id'],
    nome: pessoa['nome'],
    rg: texto(pessoa['rg']),
    orgao_emissor_rg: texto(pessoa['orgao_emissor_rg']),
    cpf: texto(pessoa['cpf']),
    email: texto(pessoa['email']),
    telefone: texto(pessoa['telefone']),
    contato: texto(pessoa['contato']),
    parentesco: texto(ligacao['parentesco']),
  };
}

export function mapearPerfil(linha: Record<string, unknown>): CriancaPerfil | null {
  if (typeof linha['id'] !== 'string' || typeof linha['nome'] !== 'string') {
    return null;
  }

  const ligacoes = Array.isArray(linha['crianca_responsaveis'])
    ? linha['crianca_responsaveis'].map(registro).filter((item) => item !== null)
    : [];
  const principal =
    ligacoes.find((item) => item['principal'] === true) ?? ligacoes[0] ?? null;
  const vinculos = Array.isArray(linha['crianca_beneficios']) ? linha['crianca_beneficios'] : [];

  return {
    id: linha['id'],
    nome: linha['nome'],
    rg: texto(linha['rg']),
    orgao_emissor_rg: texto(linha['orgao_emissor_rg']),
    cpf: texto(linha['cpf']),
    data_nascimento: texto(linha['data_nascimento']),
    data_ingresso: texto(linha['data_ingresso']),
    status: status(linha['status']),
    recebe_beneficio: situacao(linha['recebe_beneficio']),
    observacoes: texto(linha['observacoes']),
    responsavel: principal ? responsavelDaLigacao(principal) : null,
    beneficios: vinculos
      .map(registro)
      .map((item) => item?.['beneficio_id'])
      .filter((item): item is string => typeof item === 'string'),
  };
}
