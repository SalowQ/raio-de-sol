import { FormControl, type ValidatorFn } from '@angular/forms';

/** Limite do parentesco. A lista da tela é atalho; Outros continua texto livre. */
export const TAMANHO_MAXIMO_PARENTESCO = 80;

export const PARENTESCO_OUTROS = 'Outros';

export const OPCOES_PARENTESCO = [
  'Mãe',
  'Pai',
  'Avó',
  'Avô',
  'Irmã',
  'Irmão',
  'Tia',
  'Tio',
  'Madrasta',
  'Padrasto',
  'Responsável legal',
  'Tutor',
  PARENTESCO_OUTROS,
] as const;

export const parentescoOpcional: ValidatorFn = (controle) => {
  const valor = controle.value;
  if (typeof valor !== 'string') {
    return null;
  }

  if (valor.trim().length > TAMANHO_MAXIMO_PARENTESCO) {
    return { parentescoLongo: true };
  }

  return null;
};

export function criarControleParentesco(
  valor: string | null = null,
): FormControl<string | null> {
  return new FormControl<string | null>(valor, {
    validators: [parentescoOpcional],
  });
}

/** Converte branco em nulo para não gravar parentesco vazio como texto. */
export function normalizarParentesco(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();
  return texto.length === 0 ? null : texto;
}

const parentescosDaLista = new Set<string>(
  OPCOES_PARENTESCO.filter((opcao) => opcao !== PARENTESCO_OUTROS),
);

export function separarParentesco(valor: string | null | undefined): {
  opcao: string | null;
  outro: string;
} {
  const texto = normalizarParentesco(valor);
  if (!texto || parentescosDaLista.has(texto)) {
    return { opcao: texto, outro: '' };
  }

  return {
    opcao: PARENTESCO_OUTROS,
    outro: texto === PARENTESCO_OUTROS ? '' : texto,
  };
}

export function juntarParentesco(
  opcao: string | null | undefined,
  outro: string | null | undefined,
): string | null {
  const escolhido = normalizarParentesco(opcao);
  if (!escolhido) {
    return null;
  }

  if (escolhido !== PARENTESCO_OUTROS) {
    return escolhido;
  }

  return normalizarParentesco(outro) ?? PARENTESCO_OUTROS;
}
