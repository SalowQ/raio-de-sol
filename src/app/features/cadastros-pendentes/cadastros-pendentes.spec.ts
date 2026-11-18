import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CadastrosPendentes } from './cadastros-pendentes';
import { LinksServico } from '../familia/links-servico';

describe('CadastrosPendentes', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('aprova só o envio que criou uma criança e deixa o outro para conferência', async () => {
    await TestBed.configureTestingModule({
      imports: [CadastrosPendentes],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: LinksServico,
          useValue: {
            listarCadastros: () =>
              Promise.resolve([
                {
                  id: 'link-ativo',
                  expira_em: '2099-11-20T12:00:00.000Z',
                  revogado_em: null,
                  criado_em: '2026-11-17T12:00:00.000Z',
                  token: 'abc123',
                  cadastros: [
                    {
                      id: 'manual',
                      criado_em: '2026-11-17T13:00:00.000Z',
                      status: 'enviado',
                      crianca_id: null,
                      conferir_manualmente: true,
                      observacao: null,
                      dados: {
                        crianca: { nome: 'Criança Exemplo' },
                        responsavel: { nome: 'Responsável Exemplo' },
                      },
                      criancas: null,
                      arquivos_quarentena: [],
                    },
                    {
                      id: 'nova',
                      criado_em: '2026-11-17T12:00:00.000Z',
                      status: 'enviado',
                      crianca_id: 'crianca-1',
                      conferir_manualmente: false,
                      observacao: null,
                      dados: null,
                      criancas: { nome: 'Outra Criança' },
                      arquivos_quarentena: [],
                    },
                  ],
                },
                {
                  id: 'link-antigo',
                  expira_em: '2099-11-20T12:00:00.000Z',
                  revogado_em: null,
                  criado_em: '2026-11-16T12:00:00.000Z',
                  token: null,
                  cadastros: [],
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CadastrosPendentes);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const fechado = fixture.nativeElement.textContent as string;
    expect(fechado).toContain('Link de');
    expect(fechado).toContain('2 pendentes');
    expect(fechado).toContain('0 aprovados');
    expect(fechado).toContain('0 reprovados');
    expect(fechado).not.toContain('Aprovar');
    expect(fechado).not.toContain('Outra Criança');

    const linhas = [...fixture.nativeElement.querySelectorAll('button.linha')] as HTMLButtonElement[];
    expect(linhas.length).toBe(2);
    linhas.forEach((botao) => botao.click());
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Conferência manual');
    expect(texto).toContain('não criou outro cadastro');
    expect(texto).toContain('Outra Criança');
    expect(texto).toContain('Link ativo');
    const campo = fixture.nativeElement.querySelector('.detalhe .link input') as HTMLInputElement;
    expect(campo.value).toContain('/familia/cadastro/abc123');
    expect(texto).toContain('Gere outro para copiar o endereço.');
    const aprovar = [...fixture.nativeElement.querySelectorAll('button')].filter((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Aprovar'),
    );
    expect(aprovar.length).toBe(1);
    expect(texto).not.toContain('Pedir correção');
  });
});
