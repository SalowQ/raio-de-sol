import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HistoricoNavegacao } from '../../../core/historico-navegacao';
import { BotaoVoltar } from './botao-voltar';

@Component({ template: '' })
class PaginaVazia {}

describe('BotaoVoltar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'painel', component: PaginaVazia },
          { path: 'criancas', component: PaginaVazia },
          { path: 'criancas/:id', component: PaginaVazia },
        ]),
      ],
    });
    TestBed.inject(HistoricoNavegacao);
  });

  it('volta para a url anterior e some na listagem e na home', async () => {
    const rotas = TestBed.inject(Router);
    await rotas.navigateByUrl('/painel');
    await rotas.navigateByUrl('/criancas');
    await rotas.navigateByUrl('/criancas/1');

    const fixture = TestBed.createComponent(BotaoVoltar);
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.textContent).toContain('Voltar');
    expect(botao.querySelector('path')?.getAttribute('d')).toContain('M14.5');

    botao.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rotas.url).toBe('/criancas');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    await rotas.navigateByUrl('/painel');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('sem histórico volta para a listagem da página', async () => {
    const rotas = TestBed.inject(Router);
    await rotas.navigateByUrl('/criancas/1');

    const fixture = TestBed.createComponent(BotaoVoltar);
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.textContent).toContain('Voltar');

    botao.click();
    await fixture.whenStable();

    expect(rotas.url).toBe('/criancas');
  });
});
