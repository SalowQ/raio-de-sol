export type StatusCrianca = 'pendente_validacao' | 'ativo' | 'inativo';

export type SituacaoBeneficio = 'nao_recebe' | 'recebe' | 'nao_informado';

export interface CriancaResumo {
  id: string;
  nome: string;
  status: StatusCrianca;
  recebe_beneficio: SituacaoBeneficio;
}

export interface BeneficioCatalogo {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface ResponsavelCadastro {
  id: string;
  nome: string;
  rg: string | null;
  orgao_emissor_rg: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  contato: string | null;
  parentesco: string | null;
}

export interface CriancaPerfil {
  id: string;
  nome: string;
  rg: string | null;
  orgao_emissor_rg: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  data_ingresso: string | null;
  status: StatusCrianca;
  recebe_beneficio: SituacaoBeneficio;
  observacoes: string | null;
  responsavel: ResponsavelCadastro | null;
  beneficios: string[];
}

export interface DadosCadastro {
  crianca: {
    nome: string;
    rg: string | null;
    orgao_emissor_rg: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    data_ingresso: string | null;
    status: StatusCrianca;
    recebe_beneficio: SituacaoBeneficio;
    observacoes: string | null;
  };
  responsavel: {
    nome: string;
    rg: string | null;
    orgao_emissor_rg: string | null;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
    parentesco: string | null;
  };
  beneficios: string[];
}

export interface PaginaCriancas {
  itens: CriancaResumo[];
  total: number;
}
