import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import type { BeneficioCatalogo, SituacaoBeneficio, StatusCrianca } from '../../models/cadastro';
import type { TipoDocumento } from '../../models/documento';
import { ChecklistCrianca } from '../documentos/checklist-crianca';
import { DocumentoServico } from '../documentos/documento-servico';
import { CampoParentesco } from '../../shared/components/campo-parentesco/campo-parentesco';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { criarControleParentesco, separarParentesco } from '../../shared/validators/parentesco';
import { CadastroConcluido } from './cadastro-concluido';
import { CadastroServico } from './cadastro-servico';
import {
  beneficiosCompativeis,
  cpfOpcional,
  emailOpcional,
  isoParaData,
  mascararCpf,
  mascararEmail,
  mascararOrgaoEmissor,
  mascararTelefone,
  montarDadosCadastro,
  nomeObrigatorio,
  SITUACOES_BENEFICIO,
  STATUS_CRIANCA,
  telefoneOpcional,
} from './regras-cadastro';

registerLocaleData(localePt);

@Component({
  selector: 'app-formulario-crianca',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatTabsModule,
    CampoParentesco,
    ChecklistCrianca,
    Carregando,
    EstadoErro,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
  templateUrl: './formulario-crianca.html',
  styleUrl: './formulario-crianca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioCrianca implements OnInit {
  private readonly cadastro = inject(CadastroServico);
  private readonly documentos = inject(DocumentoServico);
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(MatSnackBar);

  readonly statusOpcoes = STATUS_CRIANCA;
  readonly situacoes = SITUACOES_BENEFICIO;
  readonly beneficios = signal<BeneficioCatalogo[]>([]);
  readonly tipos = signal<TipoDocumento[]>([]);
  readonly arquivos = signal<ReadonlyMap<string, File>>(new Map());
  readonly carregando = signal(true);
  readonly pronto = signal(false);
  readonly salvando = signal(false);
  readonly enviado = signal(false);
  readonly erro = signal<string | null>(null);
  readonly id = signal<string | null>(null);
  readonly aba = signal(0);

  readonly formulario = new FormGroup(
    {
      nome: new FormControl('', { nonNullable: true, validators: [nomeObrigatorio] }),
      rg: new FormControl('', { nonNullable: true }),
      orgaoEmissorRg: new FormControl('', { nonNullable: true }),
      cpf: new FormControl('', { nonNullable: true, validators: [cpfOpcional] }),
      dataNascimento: new FormControl<Date | null>(null),
      dataIngresso: new FormControl<Date | null>(null),
      status: new FormControl<StatusCrianca>('ativo', { nonNullable: true }),
      recebeBeneficio: new FormControl<SituacaoBeneficio>('nao_informado', { nonNullable: true }),
      observacoes: new FormControl('', { nonNullable: true }),
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
    void this.carregar();
  }

  async salvar(): Promise<void> {
    this.enviado.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.salvando()) {
      this.aba.set(0);
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);

    try {
      const dados = montarDadosCadastro(this.formulario.getRawValue());
      const id = this.id();
      if (id) {
        await this.cadastro.atualizar(id, dados);
        await this.roteador.navigate(['/criancas', id]);
        return;
      }

      const destino = await this.cadastro.cadastrar(dados);
      await this.enviarDocumentos(destino);
      const escolha = await firstValueFrom(
        this.dialogos
          .open(CadastroConcluido, {
            data: { nome: dados.crianca.nome },
            disableClose: true,
            width: '32rem',
            autoFocus: 'first-tabbable',
          })
          .afterClosed(),
      );

      if (escolha === 'perfil') {
        await this.roteador.navigate(['/criancas', destino]);
        return;
      }

      this.limparParaOutroCadastro();
    } catch (erro: unknown) {
      this.avisos.open(textoDoErro(erro), 'Fechar', {
        duration: 8000,
        panelClass: 'aviso-erro',
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
    } finally {
      this.salvando.set(false);
    }
  }

  alternarBeneficio(id: string, marcado: boolean): void {
    const atual = this.formulario.controls.beneficios.value;
    const proximos = marcado ? [...atual, id] : atual.filter((item) => item !== id);
    this.formulario.controls.beneficios.setValue(proximos);
  }

  beneficioMarcado(id: string): boolean {
    return this.formulario.controls.beneficios.value.includes(id);
  }

  aoDigitarCpf(campo: 'cpf' | 'responsavelCpf', evento: Event): void {
    this.aplicarMascara(campo, mascararCpf(valorDoEvento(evento)));
  }

  aoDigitarTelefone(evento: Event): void {
    this.aplicarMascara('telefone', mascararTelefone(valorDoEvento(evento)));
  }

  aoDigitarEmail(evento: Event): void {
    this.aplicarMascara('email', mascararEmail(valorDoEvento(evento)));
  }

  aoDigitarOrgao(campo: 'orgaoEmissorRg' | 'responsavelOrgaoEmissor', evento: Event): void {
    this.aplicarMascara(campo, mascararOrgaoEmissor(valorDoEvento(evento)));
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

  private limparParaOutroCadastro(): void {
    this.enviado.set(false);
    this.formulario.reset({
      nome: '',
      rg: '',
      orgaoEmissorRg: '',
      cpf: '',
      dataNascimento: null,
      dataIngresso: null,
      status: 'ativo',
      recebeBeneficio: 'nao_informado',
      observacoes: '',
      responsavelNome: '',
      responsavelRg: '',
      responsavelOrgaoEmissor: '',
      responsavelCpf: '',
      email: '',
      telefone: '',
      parentesco: null,
      parentescoOutro: null,
      beneficios: [],
    });
    this.arquivos.set(new Map());
    window.scrollTo({ top: 0 });
  }

  private async enviarDocumentos(criancaId: string): Promise<void> {
    const falhas: string[] = [];
    for (const [tipoId, arquivo] of this.arquivos()) {
      const tipo = this.tipos().find((item) => item.id === tipoId);
      try {
        await this.documentos.enviar(criancaId, tipoId, arquivo);
      } catch (erro: unknown) {
        falhas.push(`${tipo?.nome ?? 'Documento'}: ${textoDoErro(erro)}`);
      }
    }
    if (falhas.length > 0) {
      this.avisos.open(falhas.join(' '), 'Fechar', {
        duration: 8000,
        panelClass: 'aviso-erro',
        horizontalPosition: 'center',
        verticalPosition: 'top',
      });
    }
  }

  private aplicarMascara(
    campo: 'cpf' | 'responsavelCpf' | 'telefone' | 'email' | 'orgaoEmissorRg' | 'responsavelOrgaoEmissor',
    valor: string,
  ): void {
    this.formulario.controls[campo].setValue(valor, { emitEvent: false });
    const alvo = document.activeElement;
    if (alvo instanceof HTMLInputElement && alvo.value !== valor) {
      alvo.value = valor;
    }
  }

  private async carregar(): Promise<void> {
    const id = this.rota.snapshot.paramMap.get('id');
    this.id.set(id);

    try {
      this.beneficios.set(await this.cadastro.listarBeneficios());
      if (!id) {
        try {
          this.tipos.set(await this.documentos.listarTipos());
        } catch (erro: unknown) {
          this.erro.set(textoDoErro(erro));
        }
        this.pronto.set(true);
        return;
      }

      const perfil = await this.cadastro.obter(id);
      if (!perfil) {
        this.erro.set('Cadastro não encontrado.');
        return;
      }

      const parentesco = separarParentesco(perfil.responsavel?.parentesco);
      this.formulario.patchValue({
        nome: perfil.nome,
        rg: perfil.rg ?? '',
        orgaoEmissorRg: mascararOrgaoEmissor(perfil.orgao_emissor_rg ?? ''),
        cpf: perfil.cpf ? mascararCpf(perfil.cpf) : '',
        dataNascimento: isoParaData(perfil.data_nascimento),
        dataIngresso: isoParaData(perfil.data_ingresso),
        status: perfil.status,
        recebeBeneficio: perfil.recebe_beneficio,
        observacoes: perfil.observacoes ?? '',
        responsavelNome: perfil.responsavel?.nome ?? '',
        responsavelRg: perfil.responsavel?.rg ?? '',
        responsavelOrgaoEmissor: mascararOrgaoEmissor(perfil.responsavel?.orgao_emissor_rg ?? ''),
        responsavelCpf: perfil.responsavel?.cpf ? mascararCpf(perfil.responsavel.cpf) : '',
        email: perfil.responsavel?.email ?? '',
        telefone: perfil.responsavel?.telefone ? mascararTelefone(perfil.responsavel.telefone) : '',
        parentesco: parentesco.opcao,
        parentescoOutro: parentesco.outro,
        beneficios: perfil.beneficios,
      });
      this.pronto.set(true);
    } catch (erro: unknown) {
      this.erro.set(textoDoErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }
}

function valorDoEvento(evento: Event): string {
  const alvo = evento.target;
  return alvo instanceof HTMLInputElement ? alvo.value : '';
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error
    ? erro.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}
