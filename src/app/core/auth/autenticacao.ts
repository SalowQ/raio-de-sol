import { Injectable, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { ehPerfilUsuario, type PerfilUsuario } from '../../models/perfil-usuario';
import { SupabaseCliente } from '../services/supabase-cliente';
import { TratamentoErros } from '../services/tratamento-erros';

const MENSAGEM_SEM_SERVIDOR =
  'O sistema ainda não está conectado ao servidor. Peça ajuda a quem configurou o ambiente.';
const MENSAGEM_SEM_PERMISSAO = 'Esta conta não tem permissão para o painel administrativo.';

@Injectable({ providedIn: 'root' })
export class Autenticacao {
  private readonly supabase = inject(SupabaseCliente);
  private readonly erros = inject(TratamentoErros);
  private readonly inicio: Promise<void>;

  readonly carregando = signal(true);
  readonly sessao = signal<Session | null>(null);
  readonly perfil = signal<PerfilUsuario | null>(null);
  readonly nome = computed(() => this.perfil()?.nome ?? '');

  constructor() {
    this.inicio = this.iniciar();
  }

  aguardarInicio(): Promise<void> {
    return this.inicio;
  }

  perfilAtivo(): boolean {
    const perfil = this.perfil();
    return perfil?.papel === 'funcionario' && perfil.ativo === true;
  }

  async entrar(email: string, senha: string): Promise<string | null> {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      return MENSAGEM_SEM_SERVIDOR;
    }

    const { data, error } = await cliente.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error || !data.session) {
      return error
        ? this.erros.mensagemAmigavel(error)
        : 'Não foi possível concluir a operação. Tente novamente.';
    }

    await this.definirSessao(data.session);
    if (!this.perfilAtivo()) {
      await this.sair();
      return MENSAGEM_SEM_PERMISSAO;
    }

    return null;
  }

  async solicitarRedefinicao(email: string): Promise<string | null> {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      return MENSAGEM_SEM_SERVIDOR;
    }

    const origem = globalThis.location?.origin ?? 'http://localhost:4200';
    const { error } = await cliente.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origem}/entrar`,
    });

    if (!error || this.erros.contaAusente(error)) {
      return null;
    }

    return this.erros.mensagemAmigavel(error);
  }

  async sair(): Promise<void> {
    await this.supabase.cliente?.auth.signOut();
    this.sessao.set(null);
    this.perfil.set(null);
  }

  private async iniciar(): Promise<void> {
    try {
      const cliente = this.supabase.cliente;
      if (!cliente) {
        return;
      }

      const { data } = await cliente.auth.getSession();
      await this.definirSessao(data.session);
      cliente.auth.onAuthStateChange((_evento, sessao) => {
        void this.definirSessao(sessao);
      });
    } catch {
      this.sessao.set(null);
      this.perfil.set(null);
    } finally {
      this.carregando.set(false);
    }
  }

  private async definirSessao(sessao: Session | null): Promise<void> {
    this.sessao.set(sessao);
    if (!sessao) {
      this.perfil.set(null);
      return;
    }

    await this.carregarPerfil(sessao.user.id);
  }

  private async carregarPerfil(usuarioId: string): Promise<void> {
    const cliente = this.supabase.cliente;
    if (!cliente) {
      this.perfil.set(null);
      return;
    }

    const { data, error } = await cliente
      .from('perfis_usuarios')
      .select('id, nome, papel, ativo')
      .eq('id', usuarioId)
      .maybeSingle();

    if (error || !ehPerfilUsuario(data)) {
      this.perfil.set(null);
      return;
    }

    this.perfil.set(data);
  }
}
