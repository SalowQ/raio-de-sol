import { describe, expect, it } from 'vitest';
import { conteudoCompativel } from '../documentos/regras-documento';
import {
  decidirCadastroExterno,
  enderecoLinkAtivo,
  linkAceitaEnvio,
  mensagemLink,
  respostaConsultaPublica,
  urlDoLink,
  validarValidadeDias,
  VALIDADE_SUGERIDA_DIAS,
} from './regras-link';

describe('regras do link da família', () => {
  it('sugere 7 dias e aceita de 1 a 30', () => {
    expect(VALIDADE_SUGERIDA_DIAS).toBe(7);
    expect(validarValidadeDias(7)).toBeNull();
    expect(validarValidadeDias(0)).toBe('Informe uma validade entre 1 e 30 dias.');
    expect(validarValidadeDias(31)).toBe('Informe uma validade entre 1 e 30 dias.');
  });

  it('explica quando o SQL do envio de arquivos ainda não foi aplicado', () => {
    expect(mensagemLink('new row violates row-level security policy')).toBe(
      'Aplique o SQL novo do envio de arquivos da família no Supabase e tente de novo.',
    );
  });

  it('não cria outra criança quando o CPF já existe', () => {
    expect(decidirCadastroExterno(false)).toBe('criar');
    expect(decidirCadastroExterno(true)).toBe('conferir');
  });

  it('recusa link revogado, expirado ou já aprovado', () => {
    const agora = new Date('2026-11-17T12:00:00.000Z');
    expect(
      linkAceitaEnvio(
        { expiraEm: '2026-11-18T12:00:00.000Z', revogadoEm: null, status: 'aberto' },
        agora,
      ),
    ).toBe(true);
    expect(
      linkAceitaEnvio(
        { expiraEm: '2026-11-18T12:00:00.000Z', revogadoEm: '2026-11-17T11:00:00.000Z', status: 'aberto' },
        agora,
      ),
    ).toBe(false);
    expect(
      linkAceitaEnvio(
        { expiraEm: '2026-11-17T11:00:00.000Z', revogadoEm: null, status: 'enviado' },
        agora,
      ),
    ).toBe(false);
    expect(
      linkAceitaEnvio(
        { expiraEm: '2026-11-18T12:00:00.000Z', revogadoEm: null, status: 'aprovado' },
        agora,
      ),
    ).toBe(false);
  });

  it('monta o endereço só com o token e a finalidade', () => {
    expect(urlDoLink('http://localhost:4200/', 'cadastro', 'abc')).toBe(
      'http://localhost:4200/familia/cadastro/abc',
    );
    expect(urlDoLink('http://localhost:4200', 'documentos', 'abc')).not.toContain('crianca');
    expect(
      enderecoLinkAtivo(
        'http://localhost:4200',
        'cadastro',
        {
          token: 'abc',
          expiraEm: '2099-01-01T00:00:00.000Z',
          revogadoEm: null,
          status: 'aberto',
        },
        new Date('2026-11-17T12:00:00.000Z'),
      ),
    ).toBe('http://localhost:4200/familia/cadastro/abc');
    expect(
      enderecoLinkAtivo(
        'http://localhost:4200',
        'cadastro',
        {
          token: null,
          expiraEm: '2099-01-01T00:00:00.000Z',
          revogadoEm: null,
          status: 'aberto',
        },
        new Date('2026-11-17T12:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('esconde dados de outro cadastro na resposta pública', () => {
    const resposta = respostaConsultaPublica({
      valido: true,
      finalidade: 'cadastro',
      crianca_id: 'outra-crianca',
      token_hash: 'segredo',
      conferir_manualmente: true,
      criado_por: 'funcionario',
    });

    expect(resposta['valido']).toBe(true);
    expect(resposta['crianca_id']).toBeUndefined();
    expect(resposta['token_hash']).toBeUndefined();
    expect(resposta['conferir_manualmente']).toBeUndefined();
    expect(resposta['criado_por']).toBeUndefined();
  });

  it('confere o conteúdo e não só a extensão', () => {
    expect(conteudoCompativel('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      true,
    );
    expect(conteudoCompativel('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(
      conteudoCompativel(
        'image/png',
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(conteudoCompativel('application/pdf', new Uint8Array([0x4d, 0x5a, 0x00, 0x00]))).toBe(
      false,
    );
  });
});
