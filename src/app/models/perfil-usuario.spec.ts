import { ehPerfilUsuario } from './perfil-usuario';

describe('ehPerfilUsuario', () => {
  it('aceita funcionário ativo', () => {
    expect(
      ehPerfilUsuario({
        id: 'usuario-1',
        nome: 'Equipe Teste',
        papel: 'funcionario',
        ativo: true,
      }),
    ).toBe(true);
  });

  it('recusa papel diferente e valor incompleto', () => {
    expect(
      ehPerfilUsuario({
        id: 'usuario-1',
        nome: 'Equipe Teste',
        papel: 'familia',
        ativo: true,
      }),
    ).toBe(false);
    expect(ehPerfilUsuario(null)).toBe(false);
    expect(ehPerfilUsuario({ id: 'usuario-1' })).toBe(false);
  });
});
