import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Autenticacao } from '../../core/auth/autenticacao';
import { SupabaseCliente } from '../../core/services/supabase-cliente';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';

type ModoAcesso = 'entrar' | 'recuperar';

@Component({
  selector: 'app-entrar',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    Carregando,
    EstadoErro,
  ],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Entrar {
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseCliente);
  readonly autenticacao = inject(Autenticacao);
  readonly servidorConfigurado = this.supabase.configurado;

  readonly modo = signal<ModoAcesso>('entrar');
  readonly enviando = signal(false);
  readonly mensagem = signal<string | null>(null);
  readonly recuperacaoEnviada = signal(false);
  readonly formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });
  readonly recuperacao = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  constructor() {
    void this.redirecionarSeAutenticado();
  }

  mostrarRecuperacao(): void {
    this.mensagem.set(null);
    this.recuperacaoEnviada.set(false);
    this.recuperacao.controls.email.setValue(this.formulario.controls.email.value);
    this.modo.set('recuperar');
  }

  mostrarEntrada(): void {
    this.mensagem.set(null);
    this.modo.set('entrar');
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.mensagem.set(null);
    const { email, senha } = this.formulario.getRawValue();
    const erro = await this.autenticacao.entrar(email, senha);
    this.enviando.set(false);

    if (erro) {
      this.mensagem.set(erro);
      return;
    }

    await this.router.navigateByUrl('/painel');
  }

  async enviarRecuperacao(): Promise<void> {
    if (this.recuperacao.invalid || this.enviando()) {
      this.recuperacao.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.mensagem.set(null);
    const erro = await this.autenticacao.solicitarRedefinicao(this.recuperacao.controls.email.value);
    this.enviando.set(false);

    if (erro) {
      this.mensagem.set(erro);
      return;
    }

    this.recuperacaoEnviada.set(true);
  }

  private async redirecionarSeAutenticado(): Promise<void> {
    await this.autenticacao.aguardarInicio();
    if (this.autenticacao.perfilAtivo()) {
      await this.router.navigateByUrl('/painel');
    }
  }
}
