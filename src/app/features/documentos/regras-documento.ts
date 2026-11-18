import type {
  DocumentoCrianca,
  ItemChecklist,
  StatusDocumento,
  TipoDocumento,
  VersaoDocumento,
} from '../../models/documento';

export const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;

const EXTENSAO_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const ROTULOS: Record<StatusDocumento, string> = {
  pendente: 'Aguardando análise',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

const MENSAGENS_CONHECIDAS = [
  'Sem permissão para enviar documentos.',
  'Cadastro não encontrado.',
  'Tipo de documento não encontrado.',
  'Informe o nome do arquivo.',
  'Envie um PDF, JPEG ou PNG.',
  'O arquivo deve ter até 10 MB.',
  'O arquivo já foi guardado.',
  'Informe uma situação válida.',
  'A observação deve ter até 500 caracteres.',
  'O conteúdo do arquivo não corresponde a PDF, JPEG ou PNG.',
  'O arquivo ainda está na quarentena.',
];

export function conteudoCompativel(mime: string, bytes: Uint8Array): boolean {
  if (mime === 'application/pdf') {
    return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }

  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mime === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return false;
}

export function validarArquivo(arquivo: { type: string; size: number }): string | null {
  if (!(arquivo.type in EXTENSAO_POR_MIME)) {
    return 'Envie um PDF, JPEG ou PNG.';
  }

  if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    return 'O arquivo deve ter até 10 MB.';
  }

  return null;
}

export function montarChecklist(
  tipos: TipoDocumento[],
  documentos: DocumentoCrianca[],
): ItemChecklist[] {
  return [...tipos]
    .sort((primeiro, segundo) => primeiro.ordem - segundo.ordem)
    .map((tipo) => {
      const documento = documentos.find((item) => item.tipo_id === tipo.id) ?? null;
      const versoes = documento?.versoes ?? [];
      const versaoAtual = versoes.find((versao) => versao.atual) ?? null;
      const aprovado = versoes.some((versao) => versao.status === 'aprovado');
      return {
        tipo,
        documento,
        versaoAtual,
        aprovado,
        pendente: tipo.obrigatorio && !aprovado,
      };
    });
}

export function versoesRecentes(versoes: VersaoDocumento[]): VersaoDocumento[] {
  return [...versoes].sort((primeira, segunda) => segunda.numero - primeira.numero);
}

export function rotuloVersao(status: StatusDocumento | null): string {
  return status ? ROTULOS[status] : 'Não enviado';
}

export function rotuloQuantidadeDocumentos(enviados: number, total: number): string {
  return `${enviados}/${total} documentos`;
}

export function mensagemDocumento(mensagem: string | undefined): string {
  const conhecida = MENSAGENS_CONHECIDAS.find((item) => mensagem?.includes(item));
  return conhecida ?? 'Não foi possível concluir a operação. Tente novamente.';
}

export function formatarQuando(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return 'Data não informada';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data);
}
