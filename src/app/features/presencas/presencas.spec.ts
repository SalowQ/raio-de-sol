import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AtendimentoServico } from './atendimento-servico';
import { Presencas } from './presencas';
import { diaLocal } from './regras-atendimento';

describe('Presencas', () => {
  it('lista os dias e só busca os registros ao abrir um dia', async () => {
    const pedidos: string[] = [];
    await TestBed.configureTestingModule({
      imports: [Presencas],
      providers: [
        provideNoopAnimations(),
        {
          provide: AtendimentoServico,
          useValue: {
            listarDias: () =>
              Promise.resolve({
                dias: [
                  { dia: '2026-11-20', quantidade: 2 },
                  { dia: '2026-11-01', quantidade: 1 },
                ],
                total: 11,
              }),
            listarRegistrosDoDia: (dia: string) => {
              pedidos.push(dia);
              return Promise.resolve([
                {
                  id: 'registro-1',
                  nome: 'Criança Exemplo',
                  situacao: 'presente',
                  anotacao: 'Nota do dia',
                },
              ]);
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Presencas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const fechado = fixture.nativeElement.textContent as string;
    expect(fechado).toContain('Registro diário de atendimento');
    expect(fechado).toContain('20/11/2026');
    expect(fechado).toContain('2 registros');
    expect(fechado).toContain('1 registro');
    expect(fechado).toContain('Página 1 de 2 · 11 resultados');
    expect(fechado).not.toContain('Criança Exemplo');
    expect(pedidos).toEqual([]);

    const dia = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('20/11/2026'),
    ) as HTMLButtonElement;
    dia.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pedidos).toEqual(['2026-11-20']);
    expect(fixture.nativeElement.textContent).toContain('Criança Exemplo');
    expect(fixture.nativeElement.textContent).toContain('Presente');
    expect(fixture.nativeElement.textContent).toContain('Nota do dia');
    expect(fixture.nativeElement.querySelector('.situacao.presente')).not.toBeNull();

    dia.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pedidos).toEqual(['2026-11-20']);
    expect(fixture.nativeElement.textContent).not.toContain('Criança Exemplo');
  });

  it('adiciona com a criança escolhida e edita ou exclui o registro do dia', async () => {
    const enviados: unknown[] = [];
    const atualizados: unknown[] = [];
    const excluidos: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [Presencas],
      providers: [
        provideNoopAnimations(),
        {
          provide: AtendimentoServico,
          useValue: {
            listarDias: () =>
              Promise.resolve({
                dias: [{ dia: '2026-11-20', quantidade: 1 }],
                total: 1,
              }),
            listarRegistrosDoDia: () =>
              Promise.resolve([
                {
                  id: 'registro-1',
                  nome: 'Criança Exemplo',
                  situacao: 'presente',
                  anotacao: 'Nota do dia',
                },
              ]),
            listarCriancasAtivas: () =>
              Promise.resolve([
                { id: 'crianca-1', nome: 'Criança Exemplo' },
                { id: 'crianca-2', nome: 'Outra Criança' },
              ]),
            registrar: (...args: unknown[]) => {
              enviados.push(args);
              return Promise.resolve('novo');
            },
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

    const fixture = TestBed.createComponent(Presencas);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const adicionar = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Adicionar registro'),
    ) as HTMLButtonElement;
    adicionar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Criança');
    const select = document.body.querySelector('mat-select') as HTMLElement;
    select.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const opcao = [...document.body.querySelectorAll('mat-option')].find((item) =>
      item.textContent?.includes('Outra Criança'),
    ) as HTMLElement;
    opcao.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const falta = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.includes('Falta'),
    ) as HTMLButtonElement;
    falta.click();
    const observacao = document.body.querySelector('textarea') as HTMLTextAreaElement;
    observacao.value = 'Conversou sobre a rotina da manhã.';
    observacao.dispatchEvent(new Event('input'));
    const salvar = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.trim() === 'Salvar',
    ) as HTMLButtonElement;
    salvar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(enviados).toEqual([
      ['crianca-2', diaLocal(new Date()), 'falta', 'Conversou sobre a rotina da manhã.'],
    ]);

    const dia = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('20/11/2026'),
    ) as HTMLButtonElement;
    dia.click();
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
    expect(document.body.querySelector('mat-select')).toBeNull();
    const salvarEdicao = [...document.body.querySelectorAll('button')].find((botao) =>
      botao.textContent?.trim() === 'Salvar',
    ) as HTMLButtonElement;
    salvarEdicao.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(atualizados).toEqual([['registro-1', '2026-11-20', 'presente', 'Nota do dia']]);

    const excluir = [...fixture.nativeElement.querySelectorAll('button')].find((botao) =>
      (botao as HTMLButtonElement).textContent?.includes('Excluir'),
    ) as HTMLButtonElement;
    excluir.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('O registro de 20/11/2026 de Criança Exemplo será excluído.');
    const confirmar = [...document.body.querySelectorAll('mat-dialog-actions button')].find((botao) =>
      botao.textContent?.trim() === 'Excluir',
    ) as HTMLButtonElement;
    confirmar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(excluidos).toEqual([['registro-1']]);
  });
});
