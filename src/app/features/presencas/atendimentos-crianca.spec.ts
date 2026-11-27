import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AtendimentoServico } from './atendimento-servico';
import { AtendimentosCrianca } from './atendimentos-crianca';
import { diaLocal } from './regras-atendimento';

describe('AtendimentosCrianca', () => {
  it('mostra a anotação mais recente primeiro e pagina o restante', async () => {
    const paginas: number[] = [];
    const enviados: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [AtendimentosCrianca],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: AtendimentoServico,
          useValue: {
            listarDaCrianca: (_id: string, pagina: number) => {
              paginas.push(pagina);
              return Promise.resolve({
                itens: [
                  { id: 'recente', dia: '2026-11-20', situacao: 'presente', anotacao: 'Nota recente' },
                  { id: 'antiga', dia: '2026-11-01', situacao: 'falta', anotacao: 'Nota antiga' },
                ],
                total: 11,
                presentes: 8,
                faltas: 3,
              });
            },
            registrar: (...args: unknown[]) => {
              enviados.push(args);
              return Promise.resolve();
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AtendimentosCrianca);
    fixture.componentRef.setInput('criancaId', 'crianca-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    const notas = [...fixture.nativeElement.querySelectorAll('.lista p')].map((item) => item.textContent);
    expect(notas).toEqual(['Nota recente', 'Nota antiga']);
    expect(texto.indexOf('Nota recente')).toBeLessThan(texto.indexOf('Nota antiga'));
    expect(texto).toContain('Adicionar registro');
    expect(texto).not.toContain('Abrir o registro diário');
    expect(texto).toContain('Página 1 de 2');
    expect(texto).toContain('8 presenças e 3 faltas');
    expect(fixture.nativeElement.querySelector('header button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.situacao.presente')?.textContent).toContain('Presente');
    expect(fixture.nativeElement.querySelector('.situacao.falta')?.textContent).toContain('Falta');

    const adicionar = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Adicionar registro'),
    ) as HTMLButtonElement;
    adicionar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Observação');
    const falta = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.includes('Falta'),
    ) as HTMLButtonElement;
    falta.click();
    const observacao = document.body.querySelector('textarea') as HTMLTextAreaElement;
    observacao.value = 'Conversou sobre a rotina.';
    observacao.dispatchEvent(new Event('input'));
    const salvar = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.trim() === 'Salvar',
    ) as HTMLButtonElement;
    salvar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(enviados).toEqual([['crianca-1', diaLocal(new Date()), 'falta', 'Conversou sobre a rotina.']]);

    const proxima = fixture.nativeElement.querySelector('.mat-mdc-paginator-navigation-next') as HTMLButtonElement;
    proxima.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paginas).toContain(1);
  });

  it('edita e exclui um registro existente sem criar outro', async () => {
    const atualizados: unknown[] = [];
    const excluidos: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [AtendimentosCrianca],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: AtendimentoServico,
          useValue: {
            listarDaCrianca: () =>
              Promise.resolve({
                itens: [
                  { id: 'recente', dia: '2026-11-20', situacao: 'presente', anotacao: 'Nota recente' },
                ],
                total: 1,
                presentes: 1,
                faltas: 0,
              }),
            atualizar: (...args: unknown[]) => {
              atualizados.push(args);
              return Promise.resolve();
            },
            excluir: (...args: unknown[]) => {
              excluidos.push(args);
              return Promise.resolve();
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AtendimentosCrianca);
    fixture.componentRef.setInput('criancaId', 'crianca-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const editar = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Editar'),
    ) as HTMLButtonElement;
    editar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Editar registro');
    const salvar = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.trim() === 'Salvar',
    ) as HTMLButtonElement;
    salvar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(atualizados).toEqual([['recente', '2026-11-20', 'presente', 'Nota recente']]);

    const excluir = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Excluir'),
    ) as HTMLButtonElement;
    excluir.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmar = [...document.body.querySelectorAll('mat-dialog-actions button')].find((botao) =>
      botao.textContent?.trim() === 'Excluir',
    ) as HTMLButtonElement;
    confirmar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(excluidos).toEqual([['recente']]);
  });
});
