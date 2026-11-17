import { describe, expect, it } from 'vitest';
import { montarChecklist, rotuloVersao, validarArquivo } from './regras-documento';

const laudo = {
  id: 'tipo-laudo',
  codigo: 'laudo',
  nome: 'Laudo',
  obrigatorio: true,
  ordem: 2,
};

const rg = {
  id: 'tipo-rg',
  codigo: 'rg_crianca',
  nome: 'RG da criança',
  obrigatorio: false,
  ordem: 1,
};

describe('regras de documento', () => {
  it('aceita pdf, jpeg e png de até 10 MB', () => {
    expect(validarArquivo({ type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validarArquivo({ type: 'text/plain', size: 1024 })).toBe('Envie um PDF, JPEG ou PNG.');
    expect(validarArquivo({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe(
      'O arquivo deve ter até 10 MB.',
    );
  });

  it('marca pendência só quando o tipo é obrigatório e não há versão aprovada', () => {
    const itens = montarChecklist(
      [laudo, rg],
      [
        {
          id: 'doc-laudo',
          tipo_id: laudo.id,
          versoes: [
            {
              id: 'versao-1',
              numero: 1,
              status: 'rejeitado',
              caminho: 'a/b/c.pdf',
              nome_arquivo: 'laudo.pdf',
              tipo_mime: 'application/pdf',
              tamanho_bytes: 10,
              observacao: null,
              criado_em: '2026-11-16T12:00:00.000Z',
              atual: false,
            },
            {
              id: 'versao-2',
              numero: 2,
              status: 'pendente',
              caminho: 'a/b/d.pdf',
              nome_arquivo: 'laudo-2.pdf',
              tipo_mime: 'application/pdf',
              tamanho_bytes: 10,
              observacao: null,
              criado_em: '2026-11-16T13:00:00.000Z',
              atual: true,
            },
          ],
        },
      ],
    );

    expect(itens.map((item) => item.tipo.nome)).toEqual(['RG da criança', 'Laudo']);
    expect(itens[0].pendente).toBe(false);
    expect(itens[0].versaoAtual).toBeNull();
    expect(itens[1].pendente).toBe(true);
    expect(itens[1].versaoAtual?.numero).toBe(2);
    expect(rotuloVersao(itens[1].versaoAtual?.status ?? null)).toBe('Aguardando análise');

    itens[1].documento?.versoes.push({
      ...itens[1].documento.versoes[0],
      status: 'aprovado',
    });
    const revisto = montarChecklist([laudo], [itens[1].documento!]);
    expect(revisto[0].pendente).toBe(false);
    expect(revisto[0].aprovado).toBe(true);
  });
});
