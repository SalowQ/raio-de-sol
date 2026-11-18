import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';
import { Painel, montarIndicadores } from './painel';
import { PainelServico } from './painel-servico';

describe('Painel', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('mostra os totais e abre a listagem nos cartões que já têm rota', async () => {
    await TestBed.configureTestingModule({
      imports: [Painel],
      providers: [
        provideRouter([]),
        { provide: Autenticacao, useValue: { nome: signal('Ana') } },
        {
          provide: PainelServico,
          useValue: {
            contagens: () =>
              Promise.resolve({
                ativas: 12,
                aguardandoValidacao: 3,
                documentosEmAnalise: 4,
                criancasComPendencia: 0,
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Painel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('12');
    expect(texto).toContain('3');
    expect(texto).toContain('4');
    expect(texto).not.toContain('Ainda sem dados');

    const links = [...fixture.nativeElement.querySelectorAll('a.cartao')] as HTMLAnchorElement[];
    expect(links.map((item) => item.getAttribute('href'))).toEqual([
      '/criancas?situacao=ativo',
      '/cadastros-pendentes',
    ]);
    expect(fixture.nativeElement.querySelectorAll('article.cartao').length).toBe(2);
  });

  it('liga só as contagens que já têm uma lista', () => {
    const indicadores = montarIndicadores({
      ativas: 1,
      aguardandoValidacao: 2,
      documentosEmAnalise: 3,
      criancasComPendencia: 4,
    });

    expect(indicadores[0].caminho).toBe('/criancas');
    expect(indicadores[1].caminho).toBe('/cadastros-pendentes');
    expect(indicadores[2].caminho).toBeNull();
    expect(indicadores[3].caminho).toBeNull();
  });
});
