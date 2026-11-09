import { describe, expect, it } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';
import {
  beneficiosCompativeis,
  cpfOpcional,
  emailOpcional,
  formatarCpf,
  mascararCpf,
  mascararEmail,
  mascararOrgaoEmissor,
  mascararTelefone,
  mensagemCadastro,
  montarDadosCadastro,
  nomeObrigatorio,
  normalizarCpf,
  idadeEmAnos,
  rotuloIdade,
  rotuloPaginacao,
  telefoneOpcional,
  termoDeBusca,
} from './regras-cadastro';
import { mapearPerfil } from './mapear-perfil';

describe('regras de cadastro', () => {
  it('guarda CPF só com dígitos e aceita campo vazio', () => {
    expect(normalizarCpf('')).toBeNull();
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
    expect(cpfOpcional(new FormControl('123'))).toEqual({ cpfInvalido: true });
    expect(cpfOpcional(new FormControl(''))).toBeNull();
  });

  it('exige nome com texto e benefício quando a família recebe', () => {
    expect(nomeObrigatorio(new FormControl('   '))).toEqual({ nomeObrigatorio: true });

    const grupo = new FormGroup(
      {
        recebeBeneficio: new FormControl('recebe'),
        beneficios: new FormControl<string[]>([]),
      },
      { validators: [beneficiosCompativeis] },
    );

    expect(grupo.errors).toEqual({ beneficioObrigatorio: true });
    grupo.controls.recebeBeneficio.setValue('nao_informado');
    expect(grupo.errors).toBeNull();
  });

  it('não envia benefício nem CPF formatado quando a situação não é recebe', () => {
    const dados = montarDadosCadastro({
      nome: ' Criança Exemplo ',
      rg: ' ',
      orgaoEmissorRg: ' ',
      cpf: '390.533.447-05',
      dataNascimento: '',
      dataIngresso: '',
      status: 'ativo',
      recebeBeneficio: 'nao_recebe',
      observacoes: '  ',
      responsavelNome: 'Responsável Exemplo',
      responsavelRg: null,
      responsavelOrgaoEmissor: null,
      responsavelCpf: '',
      email: '  ',
      telefone: '',
      parentesco: '   ',
      parentescoOutro: '',
      beneficios: ['beneficio-que-nao-deve-seguir'],
    });

    expect(dados.crianca.nome).toBe('Criança Exemplo');
    expect(dados.crianca.cpf).toBe('39053344705');
    expect(dados.crianca.rg).toBeNull();
    expect(dados.crianca.observacoes).toBeNull();
    expect(dados.responsavel.parentesco).toBeNull();
    expect(dados.beneficios).toEqual([]);
  });

  it('remove caracteres curinga da pesquisa', () => {
    expect(termoDeBusca(' Ana%_ ')).toBe('Ana');
  });

  it('mostra a página atual, o total de páginas e o total de resultados', () => {
    expect(rotuloPaginacao(0, 10, 0)).toBe('Página 1 de 1 · 0 resultados');
    expect(rotuloPaginacao(0, 10, 1)).toBe('Página 1 de 1 · 1 resultado');
    expect(rotuloPaginacao(1, 10, 25)).toBe('Página 2 de 3 · 25 resultados');
  });

  it('traduz CPF duplicado e esconde erro desconhecido', () => {
    expect(mensagemCadastro('23505', 'duplicate key value')).toBe('Este CPF já está cadastrado.');
    expect(mensagemCadastro('XX000', 'stack trace interno')).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
  });

  it('formata CPF só para leitura', () => {
    expect(formatarCpf('39053344705')).toBe('390.533.447-05');
  });

  it('mascara CPF, telefone e e-mail e grava a data escolhida no calendário', () => {
    expect(mascararCpf('39053344705')).toBe('390.533.447-05');
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
    expect(mascararEmail(' Ana@Exemplo.com ')).toBe('ana@exemplo.com');
    expect(mascararOrgaoEmissor(' ssp-sp 12 ')).toBe('SSP-SP');
    expect(telefoneOpcional(new FormControl('(11) 3333-4444'))).toBeNull();
    expect(emailOpcional(new FormControl('sem-arroba'))).toEqual({ emailInvalido: true });

    const dados = montarDadosCadastro({
      nome: 'Criança Exemplo',
      rg: null,
      orgaoEmissorRg: 'SSP',
      cpf: null,
      dataNascimento: new Date(2018, 0, 5),
      dataIngresso: null,
      status: 'ativo',
      recebeBeneficio: 'nao_informado',
      observacoes: null,
      responsavelNome: 'Responsável Exemplo',
      responsavelRg: null,
      responsavelOrgaoEmissor: ' SSP ',
      responsavelCpf: null,
      email: 'Ana@Exemplo.com',
      telefone: '(11) 98765-4321',
      parentesco: 'Outros',
      parentescoOutro: 'Prima',
      beneficios: [],
    });

    expect(dados.crianca.data_nascimento).toBe('2018-01-05');
    expect(dados.crianca.orgao_emissor_rg).toBe('SSP');
    expect(dados.responsavel.orgao_emissor_rg).toBe('SSP');
    expect(dados.responsavel.email).toBe('ana@exemplo.com');
    expect(dados.responsavel.telefone).toBe('11987654321');
    expect(dados.responsavel.parentesco).toBe('Prima');
  });

  it('calcula a idade em anos completos ao lado da data', () => {
    const hoje = new Date(2026, 10, 8);
    expect(idadeEmAnos('2018-01-05', hoje)).toBe(8);
    expect(idadeEmAnos('2018-12-01', hoje)).toBe(7);
    expect(idadeEmAnos('2025-11-08', hoje)).toBe(1);
    expect(idadeEmAnos('2026-11-08', hoje)).toBe(0);
    expect(idadeEmAnos('2026-11-09', hoje)).toBeNull();
    expect(idadeEmAnos('2018-02-31', hoje)).toBeNull();
    expect(rotuloIdade(1)).toBe('1 ano');
    expect(rotuloIdade(8)).toBe('8 anos');
  });
});

describe('perfil da criança', () => {
  it('lê o responsável principal e os benefícios sem inventar parentesco', () => {
    const perfil = mapearPerfil({
      id: 'crianca-1',
      nome: 'Criança Exemplo',
      rg: null,
      cpf: '39053344705',
      data_nascimento: null,
      data_ingresso: null,
      status: 'ativo',
      recebe_beneficio: 'recebe',
      observacoes: null,
      crianca_responsaveis: [
        {
          parentesco: null,
          principal: true,
          responsaveis: {
            id: 'responsavel-1',
            nome: 'Responsável Exemplo',
            rg: null,
            cpf: null,
            contato: null,
          },
        },
      ],
      crianca_beneficios: [{ beneficio_id: 'beneficio-bpc' }],
    });

    expect(perfil?.responsavel?.nome).toBe('Responsável Exemplo');
    expect(perfil?.responsavel?.parentesco).toBeNull();
    expect(perfil?.beneficios).toEqual(['beneficio-bpc']);
  });
});
