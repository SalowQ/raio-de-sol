import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { SupabaseCliente } from '../services/supabase-cliente';
import { TratamentoErros } from '../services/tratamento-erros';
import { Autenticacao } from './autenticacao';

describe('Autenticacao', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('informa quando o servidor não está configurado', async () => {
    const servico = criarServico(null);
    await servico.aguardarInicio();

    await expect(servico.entrar('equipe@exemplo.com', 'senha-segura')).resolves.toBe(
      'O sistema ainda não está conectado ao servidor. Peça ajuda a quem configurou o ambiente.',
    );
  });

  it('traduz credencial inválida sem repetir a mensagem técnica', async () => {
    const cliente = clienteFalso();
    cliente.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const servico = criarServico(cliente as unknown as SupabaseClient);
    await servico.aguardarInicio();

    await expect(servico.entrar('equipe@exemplo.com', 'senha-segura')).resolves.toBe(
      'E-mail ou senha incorretos.',
    );
  });

  it('recusa conta autenticada sem perfil de funcionário', async () => {
    const cliente = clienteFalso();
    cliente.auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: 'usuario-1' } }, user: { id: 'usuario-1' } },
      error: null,
    });
    cliente.cadeia.maybeSingle.mockResolvedValue({ data: null, error: null });
    const servico = criarServico(cliente as unknown as SupabaseClient);
    await servico.aguardarInicio();

    await expect(servico.entrar('equipe@exemplo.com', 'senha-segura')).resolves.toBe(
      'Esta conta não tem permissão para o painel administrativo.',
    );
    expect(cliente.auth.signOut).toHaveBeenCalled();
  });

  it('trata e-mail ausente na recuperação como resposta neutra', async () => {
    const cliente = clienteFalso();
    cliente.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: 'user_not_found', message: 'User not found: equipe@exemplo.com' },
    });
    const servico = criarServico(cliente as unknown as SupabaseClient);
    await servico.aguardarInicio();

    await expect(servico.solicitarRedefinicao('equipe@exemplo.com')).resolves.toBeNull();
  });
});

function criarServico(cliente: SupabaseClient | null): Autenticacao {
  TestBed.configureTestingModule({
    providers: [
      Autenticacao,
      TratamentoErros,
      {
        provide: SupabaseCliente,
        useValue: { configurado: cliente !== null, cliente },
      },
    ],
  });
  return TestBed.inject(Autenticacao);
}

function clienteFalso() {
  const cadeia = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  cadeia.select.mockReturnValue(cadeia);
  cadeia.eq.mockReturnValue(cadeia);

  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn(() => cadeia),
    cadeia,
  };
}
