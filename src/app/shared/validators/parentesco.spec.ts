import {
  criarControleParentesco,
  normalizarParentesco,
  TAMANHO_MAXIMO_PARENTESCO,
} from './parentesco';

describe('parentesco', () => {
  it('aceita vazio porque o campo é opcional', () => {
    expect(criarControleParentesco().valid).toBe(true);
    expect(criarControleParentesco(null).valid).toBe(true);
    expect(criarControleParentesco('').valid).toBe(true);
    expect(criarControleParentesco('   ').valid).toBe(true);
  });

  it('aceita texto até o limite', () => {
    expect(criarControleParentesco('Mãe').valid).toBe(true);
    expect(criarControleParentesco('a'.repeat(TAMANHO_MAXIMO_PARENTESCO)).valid).toBe(true);
  });

  it('recusa texto acima do limite', () => {
    const controle = criarControleParentesco('a'.repeat(TAMANHO_MAXIMO_PARENTESCO + 1));
    expect(controle.hasError('parentescoLongo')).toBe(true);
  });

  it('grava branco como nulo e preserva o texto informado', () => {
    expect(normalizarParentesco(null)).toBeNull();
    expect(normalizarParentesco(undefined)).toBeNull();
    expect(normalizarParentesco('   ')).toBeNull();
    expect(normalizarParentesco('  Avó  ')).toBe('Avó');
  });
});
