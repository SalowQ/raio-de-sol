import { FormControl, type ValidatorFn } from '@angular/forms';

/** Limite do campo opcional de parentesco. A ONG não definiu uma lista fechada. */
export const TAMANHO_MAXIMO_PARENTESCO = 80;

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
