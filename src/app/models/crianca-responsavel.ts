/**
 * Ligação entre uma criança e um responsável.
 * O parentesco é opcional e vale para esta ligação, não para a pessoa em todas as crianças.
 * A coluna correspondente, criada na Etapa 2, é `crianca_responsaveis.parentesco text null`.
 */
export interface CriancaResponsavel {
  id: string;
  crianca_id: string;
  responsavel_id: string;
  parentesco: string | null;
  principal: boolean;
}
