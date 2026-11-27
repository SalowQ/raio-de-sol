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

  it('mostra o mês no calendário e guarda a anotação no dia colorido', async () => {
    const periodos: string[][] = [];
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
                itens: [],
                total: 1,
                presentes: 1,
                faltas: 0,
              }),
            listarDiasDaCrianca: () => Promise.resolve(['2026-11-20', '2026-09-02']),
            listarPeriodo: (_id: string, inicio: string, fim: string) => {
              periodos.push([inicio, fim]);
              if (inicio <= '2026-11-20' && fim >= '2026-11-20') {
                return Promise.resolve([
                  { id: 'cal', dia: '2026-11-20', situacao: 'presente', anotacao: 'Nota do calendário' },
                ]);
              }
              return Promise.resolve([
                { id: 'falta', dia: '2026-09-02', situacao: 'falta', anotacao: null },
              ]);
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

    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    const calendario = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Calendário'),
    ) as HTMLButtonElement;
    calendario.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toMatch(/^\d{4}-\d{2}$/);
    expect(select.textContent).toContain('Novembro de 2026');
    expect(select.textContent).toContain('Setembro de 2026');
    select.value = '2026-11';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const presente = fixture.nativeElement.querySelector('.celula.presente') as HTMLElement;
    expect(presente.querySelector('.numero')?.textContent?.trim()).toBe('20');
    expect(presente.querySelector('.cartao')?.textContent).toContain('Nota do calendário');
    expect(presente.querySelector('[aria-label="Editar registro"]')).not.toBeNull();
    expect(presente.querySelector('[aria-label="Excluir registro"]')).not.toBeNull();

    select.value = '2026-09';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const falta = fixture.nativeElement.querySelector('.celula.falta') as HTMLElement;
    expect(falta.querySelector('.numero')?.textContent?.trim()).toBe('2');
    expect(falta.querySelector('.cartao')?.textContent).toContain('Sem anotação.');
    expect(periodos.some(([inicio, fim]) => inicio <= '2026-11-20' && fim >= '2026-11-20')).toBe(true);
  });
});
