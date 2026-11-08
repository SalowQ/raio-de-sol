import { urlDoProjeto } from './url-do-projeto';

describe('urlDoProjeto', () => {
  it('remove o caminho REST copiado do painel', () => {
    expect(urlDoProjeto('https://exemplo.supabase.co/rest/v1/')).toBe(
      'https://exemplo.supabase.co',
    );
  });

  it('mantém a raiz do projeto', () => {
    expect(urlDoProjeto('https://exemplo.supabase.co')).toBe('https://exemplo.supabase.co');
  });
});
