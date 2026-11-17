import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CadastroServico } from './cadastro-servico';
import { Criancas } from './criancas';

describe('Criancas', () => {
  it('reúne busca, lista e paginação e mostra o total vindo da consulta', async () => {
    await TestBed.configureTestingModule({
      imports: [Criancas],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: CadastroServico,
          useValue: {
            listar: () =>
              Promise.resolve({
                itens: [
                  {
                    id: '1',
                    nome: 'Criança Exemplo',
                    status: 'ativo',
                    recebe_beneficio: 'nao_informado',
                    documentos_enviados: 0,
                    documentos_total: 10,
                  },
                  {
                    id: '2',
                    nome: 'Outra Criança',
                    status: 'inativo',
                    recebe_beneficio: 'recebe',
                    documentos_enviados: 3,
                    documentos_total: 7,
                  },
                ],
                total: 25,
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Criancas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const painel = fixture.nativeElement.querySelector('.painel-lista') as HTMLElement;
    expect(painel.querySelector('.busca')).toBeTruthy();
    expect(painel.querySelectorAll('.linha').length).toBe(2);
    expect(painel.textContent).toContain('0/10 documentos');
    expect(painel.textContent).toContain('3/7 documentos');
    expect(painel.querySelector('.paginacao')).toBeTruthy();
    expect(painel.querySelector('.resumo')?.textContent).toContain('Página 1 de 3 · 25 resultados');
    const proxima = painel.querySelector('[aria-label="Próxima página"]') as HTMLButtonElement;
    expect(proxima.disabled).toBe(false);
  });
});
