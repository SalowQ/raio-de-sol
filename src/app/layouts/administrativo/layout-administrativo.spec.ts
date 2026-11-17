import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Autenticacao } from '../../core/auth/autenticacao';
import { LayoutAdministrativo } from './layout-administrativo';

function observador(largo: boolean) {
  const estado: BreakpointState = { matches: largo, breakpoints: {} };
  return { observe: () => of(estado) };
}

async function montar(largo: boolean) {
  await TestBed.configureTestingModule({
    imports: [LayoutAdministrativo],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      { provide: BreakpointObserver, useValue: observador(largo) },
      {
        provide: Autenticacao,
        useValue: { nome: signal('Ana'), sair: () => Promise.resolve() },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LayoutAdministrativo);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('LayoutAdministrativo', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('coloca a seta dentro do menu aberto e o hambúrguer na barra quando fecha', async () => {
    const fixture = await montar(true);
    const raiz = fixture.nativeElement as HTMLElement;
    const lateral = raiz.querySelector('mat-sidenav') as HTMLElement;
    const barra = raiz.querySelector('header.barra') as HTMLElement;

    expect(lateral.querySelector('[aria-label="Ocultar menu"]')).toBeTruthy();
    expect(barra.querySelector('[aria-label="Mostrar menu"]')).toBeNull();

    (lateral.querySelector('[aria-label="Ocultar menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const hamburguer = barra.querySelector('[aria-label="Mostrar menu"]') as HTMLButtonElement;
    expect(hamburguer).toBeTruthy();
    expect(hamburguer.querySelectorAll('path').length).toBe(1);
    expect(hamburguer.querySelector('path')?.getAttribute('d')).toContain('M5 7h14');
    expect(fixture.componentInstance.menuAberto()).toBe(false);
  });
});
