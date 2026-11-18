import { mensagemCadastro } from '../criancas/regras-cadastro';
import { mensagemDocumento } from '../documentos/regras-documento';

/** Sugestão já registrada. A tela deixa o funcionário escolher de 1 a 30 dias. */
export const VALIDADE_SUGERIDA_DIAS = 7;

const MENSAGENS = [
  'Operação não autorizada.',
  'Informe uma validade entre 1 e 30 dias.',
  'Selecione ao menos um tipo de documento.',
  'Este link não está mais válido.',
  'Este link não aceita mais alterações.',
  'Este link atingiu o limite de envios.',
  'Muitos envios em pouco tempo. Aguarde alguns minutos.',
  'Este envio precisa de conferência manual e não será ligado a outro cadastro.',
  'O arquivo já foi promovido.',
  'O cadastro foi ativado, mas um arquivo continuou na quarentena. Aprove o documento no perfil da criança.',
  'Recebemos o envio. A equipe do Instituto vai conferir.',
  'Aplique o SQL novo dos links da família no Supabase e tente de novo.',
];

export function validarValidadeDias(dias: number): string | null {
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
    return 'Informe uma validade entre 1 e 30 dias.';
  }

  return null;
}

/** CPF já cadastrado não gera segunda criança e não devolve o cadastro existente. */
export function decidirCadastroExterno(cpfJaExiste: boolean): 'criar' | 'conferir' {
  return cpfJaExiste ? 'conferir' : 'criar';
}

export function linkAceitaEnvio(
  entrada: { expiraEm: string; revogadoEm: string | null; status: string },
  agora: Date,
): boolean {
  if (entrada.revogadoEm || entrada.status === 'aprovado' || entrada.status === 'encerrado') {
    return false;
  }

  const expira = new Date(entrada.expiraEm);
  return !Number.isNaN(expira.getTime()) && expira.getTime() > agora.getTime();
}

export function urlDoLink(
  origem: string,
  finalidade: 'cadastro' | 'documentos',
  token: string,
): string {
  return `${origem.replace(/\/$/, '')}/familia/${finalidade}/${token}`;
}

/** Endereço para reexibir, só enquanto o link ainda aceita envio e o token foi guardado. */
export function enderecoLinkAtivo(
  origem: string,
  finalidade: 'cadastro' | 'documentos',
  entrada: { token: string | null; expiraEm: string; revogadoEm: string | null; status: string },
  agora: Date,
): string | null {
  if (!entrada.token || !linkAceitaEnvio(entrada, agora)) {
    return null;
  }

  return urlDoLink(origem, finalidade, entrada.token);
}

/** A página pública não recebe identificadores de outro cadastro nem o segredo do link. */
export function respostaConsultaPublica(entrada: Record<string, unknown>): Record<string, unknown> {
  const copia = { ...entrada };
  delete copia['crianca_id'];
  delete copia['token_hash'];
  delete copia['token'];
  delete copia['conferir_manualmente'];
  delete copia['criado_por'];
  return copia;
}

export function mensagemLink(texto: string | undefined): string {
  if (texto?.includes('links_cadastro')) {
    return 'Aplique o SQL novo do link geral de cadastro no Supabase e tente de novo.';
  }

  if (
    texto?.includes('reservar_arquivo_familia') ||
    texto?.includes('confirmar_arquivo_familia') ||
    texto?.includes('row-level security') ||
    texto?.includes('row level security')
  ) {
    return 'Aplique o SQL novo do envio de arquivos da família no Supabase e tente de novo.';
  }

  if (
    texto?.includes('permission denied') ||
    texto?.includes('Could not find the function') ||
    texto?.includes('PGRST202')
  ) {
    return 'Aplique o SQL novo dos links da família no Supabase e tente de novo.';
  }

  const conhecida = MENSAGENS.find((item) => texto?.includes(item));
  if (conhecida) {
    return conhecida;
  }

  const cadastro = mensagemCadastro(undefined, texto);
  if (cadastro !== 'Não foi possível concluir a operação. Tente novamente.') {
    return cadastro;
  }

  return mensagemDocumento(texto);
}

export function rotuloSolicitacao(status: string, manual: boolean): string {
  if (manual) {
    return 'Conferência manual';
  }

  switch (status) {
    case 'aberto':
      return 'Link ainda não usado';
    case 'enviado':
      return 'Aguardando análise';
    case 'correcao':
      return 'Correção pedida';
    case 'aprovado':
      return 'Aprovado';
    case 'encerrado':
      return 'Encerrado';
    default:
      return status;
  }
}
