import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import type { DadosCadastro, SituacaoBeneficio, StatusCrianca } from '../../models/cadastro';
import { juntarParentesco } from '../../shared/validators/parentesco';

export { TAMANHO_PAGINA, rotuloPaginacao } from './paginacao';

export const STATUS_CRIANCA: { valor: StatusCrianca; rotulo: string }[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'pendente_validacao', rotulo: 'Aguardando validação' },
  { valor: 'inativo', rotulo: 'Inativo' },
];

export const SITUACOES_BENEFICIO: { valor: SituacaoBeneficio; rotulo: string }[] = [
  { valor: 'nao_informado', rotulo: 'Não informado' },
  { valor: 'nao_recebe', rotulo: 'Não recebe' },
  { valor: 'recebe', rotulo: 'Recebe' },
];

const MENSAGENS_CONHECIDAS = [
  'Informe o nome da criança.',
  'Informe o nome do responsável.',
  'O CPF deve ter 11 dígitos.',
  'O telefone deve ter DDD e número.',
  'Informe um e-mail válido.',
  'Informe uma data válida.',
  'Situação da criança não reconhecida.',
  'Situação de benefício não reconhecida.',
  'O parentesco pode ter no máximo 80 caracteres.',
  'Selecione ao menos um benefício.',
  'Benefício não reconhecido.',
  'Cadastro não encontrado.',
  'Operação não autorizada.',
  'Este CPF já está cadastrado.',
];

export interface ValoresFormularioCrianca {
  nome: string | null;
  rg: string | null;
  orgaoEmissorRg: string | null;
  cpf: string | null;
  dataNascimento: Date | string | null;
  dataIngresso: Date | string | null;
  status: StatusCrianca | null;
  recebeBeneficio: SituacaoBeneficio | null;
  observacoes: string | null;
  responsavelNome: string | null;
  responsavelRg: string | null;
  responsavelOrgaoEmissor: string | null;
  responsavelCpf: string | null;
  email: string | null;
  telefone: string | null;
  parentesco: string | null;
  parentescoOutro: string | null;
  beneficios: string[] | null;
}

export function somenteDigitos(valor: string | null | undefined): string {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.replace(/\D/g, '');
}

export function normalizarCpf(valor: string | null | undefined): string | null {
  const digitos = somenteDigitos(valor);
  return digitos.length === 0 ? null : digitos;
}

export function mascararCpf(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor).slice(0, 11);
  const parte1 = digitos.slice(0, 3);
  const parte2 = digitos.slice(3, 6);
  const parte3 = digitos.slice(6, 9);
  const parte4 = digitos.slice(9, 11);

  if (digitos.length <= 3) {
    return parte1;
  }
  if (digitos.length <= 6) {
    return `${parte1}.${parte2}`;
  }
  if (digitos.length <= 9) {
    return `${parte1}.${parte2}.${parte3}`;
  }

  return `${parte1}.${parte2}.${parte3}-${parte4}`;
}

export function formatarCpf(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11) {
    return valor?.trim() ?? '';
  }

  return mascararCpf(digitos);
}

export function mascararTelefone(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor).slice(0, 11);
  const ddd = digitos.slice(0, 2);
  if (digitos.length === 0) {
    return '';
  }
  if (digitos.length <= 2) {
    return `(${ddd}`;
  }
  if (digitos.length <= 6) {
    return `(${ddd}) ${digitos.slice(2)}`;
  }
  if (digitos.length <= 10) {
    return `(${ddd}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return `(${ddd}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function formatarTelefone(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 10 && digitos.length !== 11) {
    return valor?.trim() ?? '';
  }

  return mascararTelefone(digitos);
}

export function mascararOrgaoEmissor(valor: string | null | undefined): string {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.replace(/[^\p{L}-]/gu, '').toUpperCase();
}

export function mascararEmail(valor: string | null | undefined): string {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.replace(/\s/g, '').toLowerCase();
}

export function dataParaIso(valor: Date | string | null | undefined): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return null;
    }

    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }

  return textoOuNulo(valor);
}

export function isoParaData(valor: string | null | undefined): Date | null {
  const texto = textoOuNulo(valor);
  if (!texto) {
    return null;
  }

  const [ano, mes, dia] = texto.split('-').map((parte) => Number(parte));
  if (!ano || !mes || !dia) {
    return null;
  }

  return new Date(ano, mes - 1, dia);
}

/** Idade em anos completos. Data futura ou inválida não gera idade. */
export function idadeEmAnos(valor: string, hoje = new Date()): number | null {
  const [ano, mes, dia] = valor.split('-').map((parte) => Number(parte));
  if (!ano || !mes || !dia) {
    return null;
  }

  const nascimento = new Date(ano, mes - 1, dia);
  if (
    nascimento.getFullYear() !== ano ||
    nascimento.getMonth() !== mes - 1 ||
    nascimento.getDate() !== dia
  ) {
    return null;
  }

  let idade = hoje.getFullYear() - ano;
  const mesHoje = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) {
    idade -= 1;
  }

  return idade < 0 ? null : idade;
}

export function rotuloIdade(idade: number): string {
  return idade === 1 ? '1 ano' : `${idade} anos`;
}

export function textoOuNulo(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();
  return texto.length === 0 ? null : texto;
}

export function termoDeBusca(valor: string): string {
  return valor.trim().replace(/[%_]/g, '');
}

export function rotuloStatus(status: StatusCrianca): string {
  return STATUS_CRIANCA.find((item) => item.valor === status)?.rotulo ?? status;
}

export function rotuloBeneficio(situacao: SituacaoBeneficio): string {
  return SITUACOES_BENEFICIO.find((item) => item.valor === situacao)?.rotulo ?? situacao;
}

export const nomeObrigatorio: ValidatorFn = (controle) => {
  return textoOuNulo(controle.value) === null ? { nomeObrigatorio: true } : null;
};

export const cpfOpcional: ValidatorFn = (controle) => {
  const digitos = somenteDigitos(controle.value);
  if (digitos.length === 0) {
    return null;
  }

  return digitos.length === 11 ? null : { cpfInvalido: true };
};

export const telefoneOpcional: ValidatorFn = (controle) => {
  const digitos = somenteDigitos(controle.value);
  if (digitos.length === 0) {
    return null;
  }

  return digitos.length === 10 || digitos.length === 11 ? null : { telefoneInvalido: true };
};

export const emailOpcional: ValidatorFn = (controle) => {
  const email = mascararEmail(typeof controle.value === 'string' ? controle.value : '');
  if (email.length === 0) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : { emailInvalido: true };
};

export const beneficiosCompativeis: ValidatorFn = (controle: AbstractControl): ValidationErrors | null => {
  const recebe = controle.get('recebeBeneficio')?.value;
  const ids = controle.get('beneficios')?.value;
  if (recebe === 'recebe' && (!Array.isArray(ids) || ids.length === 0)) {
    return { beneficioObrigatorio: true };
  }

  return null;
};

export function montarDadosCadastro(valores: ValoresFormularioCrianca): DadosCadastro {
  const recebe = valores.recebeBeneficio ?? 'nao_informado';

  return {
    crianca: {
      nome: textoOuNulo(valores.nome) ?? '',
      rg: textoOuNulo(valores.rg),
      orgao_emissor_rg: textoOuNulo(mascararOrgaoEmissor(valores.orgaoEmissorRg)),
      cpf: normalizarCpf(valores.cpf),
      data_nascimento: dataParaIso(valores.dataNascimento),
      data_ingresso: dataParaIso(valores.dataIngresso),
      status: valores.status ?? 'ativo',
      recebe_beneficio: recebe,
      observacoes: textoOuNulo(valores.observacoes),
    },
    responsavel: {
      nome: textoOuNulo(valores.responsavelNome) ?? '',
      rg: textoOuNulo(valores.responsavelRg),
      orgao_emissor_rg: textoOuNulo(mascararOrgaoEmissor(valores.responsavelOrgaoEmissor)),
      cpf: normalizarCpf(valores.responsavelCpf),
      email: textoOuNulo(mascararEmail(valores.email)),
      telefone: somenteDigitos(valores.telefone).length === 0 ? null : somenteDigitos(valores.telefone),
      parentesco: juntarParentesco(valores.parentesco, valores.parentescoOutro),
    },
    beneficios: recebe === 'recebe' ? [...(valores.beneficios ?? [])] : [],
  };
}

export function mensagemCadastro(codigo: string | undefined, mensagem: string | undefined): string {
  if (codigo === '23505' || mensagem?.includes('Este CPF já está cadastrado')) {
    return 'Este CPF já está cadastrado.';
  }

  const conhecida = MENSAGENS_CONHECIDAS.find((item) => mensagem?.includes(item));
  return conhecida ?? 'Não foi possível concluir a operação. Tente novamente.';
}

export function mensagemServidorAusente(): string {
  return 'O servidor ainda não está configurado.';
}
