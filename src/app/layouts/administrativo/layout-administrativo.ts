import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { Autenticacao } from '../../core/auth/autenticacao';

interface ItemMenu {
  rotulo: string;
  caminho: string;
  icone: 'painel' | 'criancas' | 'pendentes' | 'documentos' | 'presenca' | 'historico' | 'configuracoes';
}

function telaLargaInicial(): boolean {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(min-width: 960px)').matches
    : true;
}

@Component({
  selector: 'app-layout-administrativo',
  imports: [
    MatButtonModule,
    MatListModule,
    MatSidenavModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './layout-administrativo.html',
  styleUrl: './layout-administrativo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutAdministrativo {
  private readonly pontos = inject(BreakpointObserver);
  private readonly autenticacao = inject(Autenticacao);
  private readonly router = inject(Router);

  readonly telaLarga = toSignal(
    this.pontos.observe('(min-width: 960px)').pipe(map((resultado) => resultado.matches)),
    { initialValue: telaLargaInicial() },
  );
  readonly menuAberto = signal(telaLargaInicial());
  readonly nome = computed(() => this.autenticacao.nome() || 'Funcionário');
  readonly inicial = computed(() => this.nome().trim().charAt(0).toUpperCase() || 'F');
  readonly itens: readonly ItemMenu[] = [
    { rotulo: 'Painel', caminho: '/painel', icone: 'painel' },
    { rotulo: 'Crianças', caminho: '/criancas', icone: 'criancas' },
    { rotulo: 'Cadastros pendentes', caminho: '/cadastros-pendentes', icone: 'pendentes' },
    { rotulo: 'Documentos', caminho: '/documentos', icone: 'documentos' },
    { rotulo: 'Presença', caminho: '/presenca', icone: 'presenca' },
    { rotulo: 'Histórico', caminho: '/historico', icone: 'historico' },
    { rotulo: 'Configurações', caminho: '/configuracoes', icone: 'configuracoes' },
  ];

  constructor() {
    effect(() => {
      this.menuAberto.set(this.telaLarga());
    });
  }

  alternarMenu(): void {
    this.menuAberto.update((aberto) => !aberto);
  }

  definirMenu(aberto: boolean): void {
    this.menuAberto.set(aberto);
  }

  aoNavegar(): void {
    if (!this.telaLarga()) {
      this.menuAberto.set(false);
    }
  }

  async sair(): Promise<void> {
    await this.autenticacao.sair();
    await this.router.navigateByUrl('/entrar');
  }
}
