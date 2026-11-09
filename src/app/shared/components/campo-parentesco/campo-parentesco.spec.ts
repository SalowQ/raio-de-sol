import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OPCOES_PARENTESCO, PARENTESCO_OUTROS, criarControleParentesco } from '../../validators/parentesco';
import { CampoParentesco } from './campo-parentesco';

describe('CampoParentesco', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampoParentesco],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  function montar(valor: string | null = null): ComponentFixture<CampoParentesco> {
    const fixture = TestBed.createComponent(CampoParentesco);
    fixture.componentRef.setInput('controle', criarControleParentesco(valor));
    fixture.componentRef.setInput('controleOutro', criarControleParentesco());
    fixture.detectChanges();
    return fixture;
  }

  it('mostra o campo como opcional e deixa Outros no fim', () => {
    const fixture = montar();
    const select = fixture.nativeElement.querySelector('mat-select') as HTMLElement;
    expect(select.getAttribute('aria-required')).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('Opcional. Pode ficar em branco.');
    expect(OPCOES_PARENTESCO.at(-1)).toBe(PARENTESCO_OUTROS);
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });

  it('abre o texto livre quando a opção é Outros', () => {
    const fixture = montar(PARENTESCO_OUTROS);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.required).toBe(false);
    expect(input.getAttribute('aria-required')).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('Qual parentesco?');
  });
});
