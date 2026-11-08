import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { criarControleParentesco } from '../../validators/parentesco';
import { CampoParentesco } from './campo-parentesco';

describe('CampoParentesco', () => {
  let fixture: ComponentFixture<CampoParentesco>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampoParentesco],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CampoParentesco);
    fixture.componentRef.setInput('controle', criarControleParentesco());
    fixture.detectChanges();
  });

  it('mostra o campo como opcional', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.required).toBe(false);
    expect(input.getAttribute('aria-required')).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('Opcional. Pode ficar em branco.');
  });
});
