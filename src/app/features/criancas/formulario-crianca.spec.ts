import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CadastroServico } from './cadastro-servico';
import { FormularioCrianca } from './formulario-crianca';
import { DocumentoServico } from '../documentos/documento-servico';

describe('FormularioCrianca', () => {
  let fixture: ComponentFixture<FormularioCrianca>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioCrianca],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: CadastroServico,
          useValue: {
            listarBeneficios: () => Promise.resolve([]),
          },
        },
        {
          provide: DocumentoServico,
          useValue: {
            listarTipos: () =>
              Promise.resolve([
                {
                  id: 'tipo-1',
                  codigo: 'receita_medicacoes',
                  nome: 'Receita de medicações',
                  obrigatorio: false,
                  ordem: 15,
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioCrianca);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('mostra órgão emissor, calendário, e-mail, telefone e máscara de CPF', async () => {
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Órgão emissor do RG');
    expect(fixture.nativeElement.querySelectorAll('mat-datepicker-toggle').length).toBe(2);

    const cpf = fixture.nativeElement.querySelector('[formcontrolname="cpf"]') as HTMLInputElement;
    cpf.value = '39053344705';
    cpf.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.formulario.controls.cpf.value).toBe('390.533.447-05');

    const orgao = fixture.nativeElement.querySelector(
      '[formcontrolname="orgaoEmissorRg"]',
    ) as HTMLInputElement;
    orgao.value = 'ssp-sp 12';
    orgao.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.formulario.controls.orgaoEmissorRg.value).toBe('SSP-SP');

    const situacao = fixture.nativeElement.querySelector('mat-form-field.linha-inteira');
    const parentesco = fixture.nativeElement.querySelector('app-campo-parentesco.linha-inteira');
    expect(situacao).toBeTruthy();
    expect(parentesco).toBeTruthy();
    expect(texto).toContain('E-mail');
    expect(texto).toContain('Telefone');
    expect(texto).toContain('Documentos');
    expect(fixture.nativeElement.querySelector('[placeholder="nome@exemplo.com"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[placeholder="(00) 00000-0000"]')).toBeTruthy();

    const aba = [...fixture.nativeElement.querySelectorAll('[role="tab"]')].find((item) =>
      (item as HTMLElement).textContent?.includes('Documentos'),
    ) as HTMLElement;
    aba.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Receita de medicações');
    expect(fixture.nativeElement.textContent).toContain('Escolher arquivo');
  });

  it('pergunta se cadastra outra criança ou abre o perfil', async () => {
    const servico = TestBed.inject(CadastroServico) as unknown as {
      cadastrar: () => Promise<string>;
    };
    servico.cadastrar = () => Promise.resolve('crianca-1');
    preencherMinimo(fixture);

    const pendente = fixture.componentInstance.salvar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Cadastro concluído');
    expect(document.body.textContent).toContain('Criança Exemplo');

    const botao = [...document.body.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Cadastrar outra'),
    ) as HTMLButtonElement;
    botao.click();
    await pendente;
    fixture.detectChanges();

    expect(fixture.componentInstance.formulario.controls.nome.value).toBe('');
  });

  it('envia os documentos escolhidos ao salvar um cadastro novo', async () => {
    const enviados: string[] = [];
    const documentos = TestBed.inject(DocumentoServico) as unknown as {
      enviar: (criancaId: string, tipoId: string, arquivo: File) => Promise<void>;
    };
    documentos.enviar = (criancaId, tipoId) => {
      enviados.push(`${criancaId}:${tipoId}`);
      return Promise.resolve();
    };
    const servico = TestBed.inject(CadastroServico) as unknown as {
      cadastrar: () => Promise<string>;
    };
    servico.cadastrar = () => Promise.resolve('crianca-1');
    preencherMinimo(fixture);

    const entrada = { files: [new File(['%PDF'], 'receita.pdf', { type: 'application/pdf' })], value: 'x' };
    fixture.componentInstance.escolherArquivo('tipo-1', { target: entrada } as unknown as Event);
    expect(fixture.componentInstance.nomeArquivo('tipo-1')).toBe('receita.pdf');
    expect(entrada.value).toBe('');

    const pendente = fixture.componentInstance.salvar();
    await fixture.whenStable();
    fixture.detectChanges();

    const botao = [...document.body.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Cadastrar outra'),
    ) as HTMLButtonElement;
    botao.click();
    await pendente;

    expect(enviados).toEqual(['crianca-1:tipo-1']);
  });

  it('mostra falha do cadastro num aviso temporário', async () => {
    const servico = TestBed.inject(CadastroServico) as unknown as {
      cadastrar: () => Promise<string>;
    };
    servico.cadastrar = () => Promise.reject(new Error('Este CPF já está cadastrado.'));
    preencherMinimo(fixture);

    await fixture.componentInstance.salvar();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Este CPF já está cadastrado.');
  });
});

function preencherMinimo(fixture: ComponentFixture<FormularioCrianca>): void {
  fixture.componentInstance.formulario.controls.nome.setValue('Criança Exemplo');
  fixture.componentInstance.formulario.controls.responsavelNome.setValue('Responsável Exemplo');
}