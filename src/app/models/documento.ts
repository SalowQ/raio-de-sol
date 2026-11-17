export type StatusDocumento = 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado';

export interface TipoDocumento {
  id: string;
  codigo: string;
  nome: string;
  obrigatorio: boolean;
  ordem: number;
}

export interface VersaoDocumento {
  id: string;
  numero: number;
  status: StatusDocumento;
  caminho: string;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho_bytes: number;
  observacao: string | null;
  criado_em: string;
  atual: boolean;
}

export interface DocumentoCrianca {
  id: string;
  tipo_id: string;
  versoes: VersaoDocumento[];
}

export interface ItemChecklist {
  tipo: TipoDocumento;
  documento: DocumentoCrianca | null;
  versaoAtual: VersaoDocumento | null;
  aprovado: boolean;
  pendente: boolean;
}

export interface ReservaVersao {
  versao_id: string;
  documento_id: string;
  caminho: string;
}
