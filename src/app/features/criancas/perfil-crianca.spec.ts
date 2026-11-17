import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import type { CriancaPerfil } from '../../models/cadastro';
import { CadastroServico } from './cadastro-servico';
import { DocumentoServico } from '../documentos/documento-servico';
import { PerfilCrianca } from './perfil-crianca';
import { idadeEmAnos, rotuloIdade } from './regras-cadastro';

const perfil: CriancaPerfil = {
  id: 'crianca-1',
  nome: 'Criança Exemplo',
  rg: null,
  orgao_emissor_rg: null,
  cpf: null,
  data_nascimento: '2018-01-05',
  data_ingresso: null,
  status: 'ativo',
  recebe_beneficio: 'recebe',
  observacoes: null,
  responsavel: null,
  beneficios: ['bpc', 'loas'],
};

describe('PerfilCrianca', () => {
  it('mostra a idade ao lado do nascimento e os benefícios no próprio campo', async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilCrianca],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'crianca-1' } } } },
        {
          provide: CadastroServico,
          useValue: {
            obter: () => Promise.resolve(perfil),
            listarBeneficios: () =>
              Promise.resolve([
                { id: 'bpc', codigo: 'bpc', nome: 'BPC', ativo: true, ordem: 1 },
                { id: 'loas', codigo: 'loas', nome: 'LOAS', ativo: true, ordem: 2 },
              ]),
          },
        },
        { provide: DocumentoServico, useValue: { checklist: () => Promise.resolve([]) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PerfilCrianca);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const titulo = fixture.nativeElement.querySelector('.titulo') as HTMLElement;
    expect(titulo.querySelector('h1')?.textContent).toContain('Criança Exemplo');
    expect(titulo.querySelector('.badge')?.textContent).toContain('Ativo');
    expect(titulo.querySelector('.badge')?.getAttribute('data-status')).toBe('ativo');

    const texto = fixture.nativeElement.textContent as string;
    const idade = idadeEmAnos('2018-01-05');
    expect(texto).toContain(`05/01/2018 (${rotuloIdade(idade ?? 0)})`);
    expect(texto).toContain('Recebe (BPC, LOAS)');
    expect(texto).not.toContain('Quais');
  });
});
