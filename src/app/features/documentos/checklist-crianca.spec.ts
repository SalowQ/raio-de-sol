import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { ItemChecklist } from '../../models/documento';
import { ChecklistCrianca } from './checklist-crianca';
import { DocumentoServico } from './documento-servico';
import { LinksServico } from '../familia/links-servico';

const itens: ItemChecklist[] = [
  {
    tipo: {
      id: 'tipo-rg',
      codigo: 'rg_crianca',
      nome: 'RG da criança',
      obrigatorio: false,
      ordem: 1,
    },
    documento: null,
    versaoAtual: null,
    aprovado: false,
    pendente: false,
  },
  {
    tipo: {
      id: 'tipo-laudo',
      codigo: 'laudo',
      nome: 'Laudo',
      obrigatorio: true,
      ordem: 2,
    },
    documento: {
      id: 'doc-laudo',
      tipo_id: 'tipo-laudo',
      versoes: [
        {
          id: 'versao-1',
          numero: 1,
          status: 'pendente',
          caminho: 'crianca/doc/versao.pdf',
          nome_arquivo: 'laudo.pdf',
          tipo_mime: 'application/pdf',
          tamanho_bytes: 20,
          observacao: null,
          criado_em: '2026-11-16T13:00:00.000Z',
          atual: true,
        },
      ],
    },
    versaoAtual: {
      id: 'versao-1',
      numero: 1,
      status: 'pendente',
      caminho: 'crianca/doc/versao.pdf',
      nome_arquivo: 'laudo.pdf',
      tipo_mime: 'application/pdf',
      tamanho_bytes: 20,
      observacao: null,
      criado_em: '2026-11-16T13:00:00.000Z',
      atual: true,
    },
    aprovado: false,
    pendente: true,
  },
];

describe('ChecklistCrianca', () => {
  it('mostra o catálogo e a pendência do tipo obrigatório', async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistCrianca],
      providers: [
        provideNoopAnimations(),
        { provide: DocumentoServico, useValue: { checklist: () => Promise.resolve(itens) } },
        {
          provide: LinksServico,
          useValue: { listarDocumentos: () => Promise.resolve([]) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChecklistCrianca);
    fixture.componentRef.setInput('criancaId', 'crianca-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('RG da criança');
    expect(texto).toContain('Opcional');
    expect(texto).toContain('Não enviado');
    expect(texto).toContain('Laudo');
    expect(texto).toContain('Pendente');
    expect(texto).toContain('Aguardando análise');
  });
});
