import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AtendimentoServico, type CriancaAtiva } from './atendimento-servico';
import {
  anotacaoOuNula,
  dataDoDia,
  diaLocal,
  LIMITE_ANOTACAO,
  type SituacaoAtendimento,
  validarRegistro,
} from './regras-atendimento';

registerLocaleData(localePt);

export interface RegistroAtendimentoDados {
  criancaId?: string;
  escolherCrianca?: boolean;
  registro?: {
    id: string;
    dia: string;
    situacao: SituacaoAtendimento;
    anotacao: string | null;
  };
}

@Component({
  selector: 'app-registro-atendimento',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
  templateUrl: './registro-atendimento.html',
  styleUrl: './registro-atendimento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroAtendimento implements OnInit {
  private readonly atendimentos = inject(AtendimentoServico);
  private readonly dialogo = inject(MatDialogRef<RegistroAtendimento, boolean>);
  readonly dados = inject<RegistroAtendimentoDados>(MAT_DIALOG_DATA);

  readonly salvando = signal(false);
  readonly enviado = signal(false);
  readonly erro = signal<string | null>(null);
  readonly criancas = signal<CriancaAtiva[]>([]);
  readonly carregandoCriancas = signal(false);
  readonly formulario = new FormGroup({
    criancaId: new FormControl<string | null>(this.dados.criancaId ?? null, {
      validators: this.dados.escolherCrianca ? [Validators.required] : [],
    }),
    dia: new FormControl<Date | null>(dataInicial(this.dados.registro?.dia), { validators: [dataObrigatoria] }),
    situacao: new FormControl<SituacaoAtendimento | null>(this.dados.registro?.situacao ?? null),
    observacao: new FormControl(this.dados.registro?.anotacao ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITE_ANOTACAO)],
    }),
  });

  ngOnInit(): void {
    if (this.dados.escolherCrianca) {
      void this.carregarCriancas();
    }
  }

  titulo(): string {
    return this.dados.registro ? 'Editar registro' : 'Adicionar registro';
  }

  marcar(situacao: SituacaoAtendimento): void {
    this.formulario.controls.situacao.setValue(situacao);
    this.erro.set(null);
  }

  async salvar(): Promise<void> {
    this.enviado.set(true);
    this.formulario.markAllAsTouched();
    const dia = this.formulario.controls.dia.value;
    const situacao = this.formulario.controls.situacao.value;
    const observacao = this.formulario.controls.observacao.value;
    const invalido = validarRegistro(situacao, observacao);
    if (this.formulario.invalid || invalido || !dia || !situacao || this.salvando()) {
      this.erro.set(invalido);
      return;
    }

    const criancaId = this.dados.escolherCrianca ? this.formulario.controls.criancaId.value : this.dados.criancaId;
    if (!this.dados.registro && !criancaId) {
      this.erro.set('Escolha a criança.');
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    try {
      if (this.dados.registro) {
        await this.atendimentos.atualizar(
          this.dados.registro.id,
          diaLocal(dia),
          situacao,
          anotacaoOuNula(observacao),
        );
      } else if (criancaId) {
        await this.atendimentos.registrar(criancaId, diaLocal(dia), situacao, anotacaoOuNula(observacao));
      }
      this.dialogo.close(true);
    } catch (erro: unknown) {
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  private async carregarCriancas(): Promise<void> {
    this.carregandoCriancas.set(true);
    try {
      this.criancas.set(await this.atendimentos.listarCriancasAtivas());
    } catch (erro: unknown) {
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.carregandoCriancas.set(false);
    }
  }
}

function dataObrigatoria(controle: AbstractControl): { dataObrigatoria: true } | null {
  const valor = controle.value;
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
    return { dataObrigatoria: true };
  }
  return null;
}

function dataInicial(dia: string | undefined): Date {
  return dia ? dataDoDia(dia) : new Date();
}
