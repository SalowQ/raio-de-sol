import { TestBed } from '@angular/core/testing';
import { Tema } from './tema';

describe('Tema', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('escuro');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('escuro');
  });

  it('começa claro e alterna para o escuro', () => {
    const tema = TestBed.inject(Tema);

    expect(tema.escuro()).toBe(false);
    expect(document.documentElement.classList.contains('escuro')).toBe(false);

    tema.alternar();

    expect(tema.escuro()).toBe(true);
    expect(document.documentElement.classList.contains('escuro')).toBe(true);
    expect(localStorage.getItem('raio-de-sol-tema')).toBe('escuro');
  });

  it('recupera o tema escuro já escolhido', () => {
    localStorage.setItem('raio-de-sol-tema', 'escuro');

    const tema = TestBed.inject(Tema);

    expect(tema.escuro()).toBe(true);
    expect(document.documentElement.classList.contains('escuro')).toBe(true);
  });
});
