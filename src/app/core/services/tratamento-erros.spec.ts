import { TratamentoErros } from './tratamento-erros';

describe('TratamentoErros', () => {
  const erros = new TratamentoErros();

  it('explica credencial inválida', () => {
    expect(erros.mensagemAmigavel({ code: 'invalid_credentials', message: 'Invalid login' })).toBe(
      'E-mail ou senha incorretos.',
    );
  });

  it('devolve mensagem genérica para erro desconhecido', () => {
    const texto = erros.mensagemAmigavel({
      code: 'PGRST200',
      message: 'token=segredo-interno',
    });

    expect(texto).toBe('Não foi possível concluir a operação. Tente novamente.');
    expect(texto.includes('segredo')).toBe(false);
    expect(texto.includes('token')).toBe(false);
  });

  it('reconhece conta ausente sem usar a mensagem original', () => {
    expect(erros.contaAusente({ code: 'user_not_found', message: 'User not found' })).toBe(true);
    expect(erros.contaAusente({ message: 'User not found' })).toBe(false);
  });
});
