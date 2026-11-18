import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { FamiliaServico } from './familia-servico';
import { FormularioFamilia } from './formulario-familia';

describe('FormularioFamilia', () => {
  const token = 'a'.repeat(64);

  async function montar(familia: Partial<FamiliaServico>) {
    await TestBed.configureTestingModule({
      imports: [FormularioFamilia],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token }) } },
        },
        { provide: FamiliaServico, useValue: familia },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FormularioFamilia);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('mostra o link inválido sem formulário', async () => {
    const fixture = await montar({
      consultar: () =>
        Promise.resolve({ valido: false, mensagem: 'Este link não está mais válido.' }),
    });

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Este link não está mais válido.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('envia o cadastro sem dizer se o CPF já existia', async () => {
    let enviados = 0;
    const fixture = await montar({
      consultar: () =>
        Promise.resolve({
          valido: true,
          finalidade: 'cadastro',
          beneficios: [],
          tipos: [],
        }),
      enviarCadastro: () => {
        enviados += 1;
        return Promise.resolve({
          mensagem: 'Recebemos o envio. A equipe do Instituto vai conferir.',
          solicitacaoId: 'solicitacao-1',
        });
      },
    });

    const componente = fixture.componentInstance;
    componente.formulario.controls.nome.setValue('Criança Exemplo');
    componente.formulario.controls.responsavelNome.setValue('Responsável Exemplo');
    await componente.salvar();
    fixture.detectChanges();

    expect(enviados).toBe(1);
    expect(fixture.nativeElement.textContent).toContain(
      'Recebemos o envio. A equipe do Instituto vai conferir.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('já está cadastrado');
  });
});
