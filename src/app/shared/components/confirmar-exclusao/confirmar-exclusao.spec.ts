import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmarExclusao } from './confirmar-exclusao';

describe('ConfirmarExclusao', () => {
  it('mostra a mensagem e só confirma no botão de excluir', async () => {
    const fechados: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [ConfirmarExclusao],
      providers: [
        provideNoopAnimations(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            titulo: 'Excluir registro',
            mensagem: 'O registro de 20/11/2026 será excluído.',
          },
        },
        { provide: MatDialogRef, useValue: { close: (valor: unknown) => fechados.push(valor) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmarExclusao);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Excluir registro');
    expect(texto).toContain('O registro de 20/11/2026 será excluído.');
    expect(fixture.nativeElement.querySelector('.sol-perigo')).not.toBeNull();

    const cancelar = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;
    cancelar.click();
    expect(fechados).toEqual([false]);
  });
});
