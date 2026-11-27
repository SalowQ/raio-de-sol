import {
  filtrarPorNome,
  montarLinhas,
  ordenarAtendimentosRecentes,
  textoFrequencia,
  textoTotaisDia,
  totaisDoDia,
  validarRegistro,
} from './regras-atendimento';

describe('regras do atendimento', () => {
  it('junta a criança ao registro do dia e deixa a anotação em branco quando não houver', () => {
    const linhas = montarLinhas(
      [
        { id: 'a', nome: 'Ana' },
        { id: 'b', nome: 'Bia' },
      ],
      [{ crianca_id: 'b', situacao: 'falta', anotacao: 'Sessão interrompida.' }],
    );

    expect(linhas[0]).toMatchObject({ nome: 'Ana', situacao: null, anotacao: '' });
    expect(linhas[1]).toMatchObject({ nome: 'Bia', situacao: 'falta', anotacao: 'Sessão interrompida.' });
  });

  it('exige presença ou falta e aceita anotação vazia', () => {
    expect(validarRegistro(null, '')).toBe('Marque presença ou falta.');
    expect(validarRegistro('presente', '   ')).toBeNull();
  });

  it('mostra totais do dia sem percentual', () => {
    const texto = textoTotaisDia(
      totaisDoDia([{ situacao: 'presente' }, { situacao: 'falta' }, { situacao: null }]),
    );
    expect(texto).toBe('1 presença, 1 falta, 1 sem registro');
    expect(texto).not.toContain('%');
    expect(textoFrequencia(2, 1)).toBe('2 presenças e 1 falta.');
  });

  it('deixa o dia mais recente na frente', () => {
    const ordenados = ordenarAtendimentosRecentes([
      { dia: '2026-11-01', anotacao: 'Nota antiga' },
      { dia: '2026-11-20', anotacao: 'Nota recente' },
      { dia: '2026-11-10', anotacao: 'Nota do meio' },
    ]);

    expect(ordenados.map((item) => item.anotacao)).toEqual([
      'Nota recente',
      'Nota do meio',
      'Nota antiga',
    ]);
  });

  it('filtra pelo nome sem alterar quem já foi contado no dia', () => {
    const linhas = montarLinhas(
      [
        { id: 'a', nome: 'Ana Luz' },
        { id: 'b', nome: 'Bia' },
      ],
      [],
    );
    expect(filtrarPorNome(linhas, 'luz').map((item) => item.nome)).toEqual(['Ana Luz']);
    expect(totaisDoDia(linhas).semRegistro).toBe(2);
  });
});
