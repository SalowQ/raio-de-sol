import { TestBed } from '@angular/core/testing';
import { BotaoTema } from './botao-tema';

describe('BotaoTema', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('escuro');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('escuro');
  });

  it('fica fixo no canto e alterna o tema', () => {
    const fixture = TestBed.createComponent(BotaoTema);
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Usar tema escuro');
    expect(getComputedStyle(fixture.nativeElement).position).toBe('fixed');

    botao.click();
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('escuro')).toBe(true);
    expect(botao.getAttribute('aria-label')).toBe('Usar tema claro');
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });
});