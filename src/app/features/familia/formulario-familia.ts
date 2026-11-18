import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { SituacaoBeneficio } from '../../models/cadastro';
import { CampoParentesco } from '../../shared/components/campo-parentesco/campo-parentesco';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { criarControleParentesco } from '../../shared/validators/parentesco';
import {
  beneficiosCompativeis,
  cpfOpcional,
  emailOpcional,
  mascararCpf,
  mascararEmail,
  mascararOrgaoEmissor,
  mascararTelefone,
  montarDadosCadastro,
  nomeObrigatorio,
  SITUACOES_BENEFICIO,
  telefoneOpcional,
} from '../criancas/regras-cadastro';
import { FamiliaServico, type BeneficioLink, type TipoLink } from './familia-servico';

registerLocaleData(localePt);

@Component({
  selector: 'app-formulario-familia',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    CampoParentesco,
    Carregando,
    EstadoErro,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
  templateUrl: './formulario-familia.html',
  styleUrl: './formulario-familia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioFamilia implements OnInit {
  private readonly familia = inject(FamiliaServico);
  private readonly rota = inject(ActivatedRoute);

  readonly situacoes = SITUACOES_BENEFICIO;
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly enviado = signal(false);
  readonly erro = signal<string | null>(null);
  readonly recebido = signal<string | null>(null);
  readonly beneficios = signal<BeneficioLink[]>([]);
  readonly tipos = signal<TipoLink[]>([]);
  readonly arquivos = signal<ReadonlyMap<string, File>>(new Map());
  private token = '';

  readonly formulario = new FormGroup(
    {
      nome: new FormControl('', { nonNullable: true, validators: [nomeObrigatorio] }),
      rg: new FormControl('', { nonNullable: true }),
      orgaoEmissorRg: new FormControl('', { nonNullable: true }),
      cpf: new FormControl('', { nonNullable: true, validators: [cpfOpcional] }),
      dataNascimento: new FormControl<Date | null>(null),
      recebeBeneficio: new FormControl<SituacaoBeneficio>('nao_informado', { nonNullable: true }),
      responsavelNome: new FormControl('', { nonNullable: true, validators: [nomeObrigatorio] }),
      responsavelRg: new FormControl('', { nonNullable: true }),
      responsavelOrgaoEmissor: new FormControl('', { nonNullable: true }),
      responsavelCpf: new FormControl('', { nonNullable: true, validators: [cpfOpcional] }),
      email: new FormControl('', { nonNullable: true, validators: [emailOpcional] }),
      telefone: new FormControl('', { nonNullable: true, validators: [telefoneOpcional] }),
      parentesco: criarControleParentesco(),
      parentescoOutro: criarControleParentesco(),
      beneficios: new FormControl<string[]>([], { nonNullable: true }),
    },
    { validators: [beneficiosCompativeis] },
  );

  ngOnInit(): void {
    this.token = this.rota.snapshot.paramMap.get('token') ?? '';
    void this.carregar();
  }

  beneficioMarcado(id: string): boolean {
    return this.formulario.controls.beneficios.value.includes(id);
  }

  alternarBeneficio(id: string, marcado: boolean): void {
    const atual = this.formulario.controls.beneficios.value;
    const proximo = marcado ? [...atual, id] : atual.filter((item) => item !== id);
    this.formulario.controls.beneficios.setValue(proximo);
    this.formulario.controls.beneficios.markAsDirty();
  }

  aoDigitarCpf(campo: 'cpf' | 'responsavelCpf', evento: Event): void {
    this.formulario.controls[campo].setValue(mascararCpf(valor(evento)));
  }

  aoDigitarTelefone(evento: Event): void {
    this.formulario.controls.telefone.setValue(mascararTelefone(valor(evento)));
  }

  aoDigitarEmail(evento: Event): void {
    this.formulario.controls.email.setValue(mascararEmail(valor(evento)));
  }

  aoDigitarOrgao(campo: 'orgaoEmissorRg' | 'responsavelOrgaoEmissor', evento: Event): void {
    this.formulario.controls[campo].setValue(mascararOrgaoEmissor(valor(evento)));
  }

  escolherArquivo(tipoId: string, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    this.arquivos.update((atual) => {
      const proximo = new Map(atual);
      if (arquivo) {
        proximo.set(tipoId, arquivo);
      } else {
        proximo.delete(tipoId);
      }
      return proximo;
    });
  }

  nomeArquivo(tipoId: string): string {
    return this.arquivos().get(tipoId)?.name ?? '';
  }

  async salvar(): Promise<void> {
    this.enviado.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.salvando()) {
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dados = montarDadosCadastro({
        ...this.formulario.getRawValue(),
        dataIngresso: null,
        status: 'pendente_validacao',
        observacoes: null,
      });
      const resultado = await this.familia.enviarCadastro(this.token, dados);
      const falhas = await this.enviarArquivos(resultado.solicitacaoId);
      this.recebido.set(resultado.mensagem);
      if (falhas.length > 0) {
        this.erro.set(falhas.join(' '));
      }
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      this.salvando.set(false);
    }
  }

  private async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const consulta = await this.familia.consultar(this.token);
      if (!consulta.valido || consulta.finalidade !== 'cadastro') {
        this.erro.set(consulta.mensagem ?? 'Este link não está mais válido.');
        return;
      }
      this.beneficios.set(consulta.beneficios ?? []);
      this.tipos.set(consulta.tipos ?? []);
      this.erro.set(null);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async enviarArquivos(solicitacaoId: string | null): Promise<string[]> {
    const falhas: string[] = [];
    for (const [tipoId, arquivo] of this.arquivos()) {
      const tipo = this.tipos().find((item) => item.id === tipoId);
      try {
        await this.familia.enviarArquivo(this.token, 'cadastro', tipoId, arquivo, solicitacaoId);
      } catch (erro: unknown) {
        const mensagem = erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';
        falhas.push(`${tipo?.nome ?? 'Documento'}: ${mensagem}`);
      }
    }
    return falhas;
  }
}

function valor(evento: Event): string {
  return (evento.target as HTMLInputElement).value;
}
