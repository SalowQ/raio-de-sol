import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { Entrar } from './entrar';

describe('Entrar', () => {
  let fixture: ComponentFixture<Entrar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Entrar],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        {
          provide: SupabaseCliente,
          useValue: { configurado: false, cliente: null },
        },
        {
          provide: Autenticacao,
          useValue: {
            carregando: signal(false),
            aguardarInicio: () => Promise.resolve(),
            perfilAtivo: () => false,
            entrar: () => Promise.resolve(null),
            solicitarRedefinicao: () => Promise.resolve(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Entrar);
    fixture.detectChanges();
  });

  it('começa inválido sem e-mail e senha', () => {
    expect(fixture.componentInstance.formulario.invalid).toBe(true);
  });

  it('aceita e-mail e senha com pelo menos 8 caracteres', () => {
    fixture.componentInstance.formulario.setValue({
      email: 'equipe@exemplo.com',
      senha: 'senha-segura',
    });
    expect(fixture.componentInstance.formulario.valid).toBe(true);
  });

  it('recusa senha curta', () => {
    fixture.componentInstance.formulario.setValue({
      email: 'equipe@exemplo.com',
      senha: 'curta',
    });
    expect(fixture.componentInstance.formulario.controls.senha.hasError('minlength')).toBe(true);
  });

  it('recusa e-mail mal formado', () => {
    fixture.componentInstance.formulario.setValue({
      email: 'equipe',
      senha: 'senha-segura',
    });
    expect(fixture.componentInstance.formulario.controls.email.hasError('email')).toBe(true);
  });

  it('explica quando o servidor não está configurado', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'O sistema ainda não está conectado ao servidor',
    );
  });

  it('mostra o que falta ao tentar entrar sem dados', async () => {
    await fixture.componentInstance.enviar();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Informe o e-mail.');
    expect(texto).toContain('Informe a senha.');
  });
});
