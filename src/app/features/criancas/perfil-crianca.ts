import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import type { BeneficioCatalogo, CriancaPerfil } from '../../models/cadastro';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { ChecklistCrianca } from '../documentos/checklist-crianca';
import { AtendimentosCrianca } from '../presencas/atendimentos-crianca';
import { CadastroServico } from './cadastro-servico';
import {
  formatarCpf,
  formatarTelefone,
  idadeEmAnos,
  rotuloBeneficio,
  rotuloIdade,
  rotuloStatus,
} from './regras-cadastro';

@Component({
  selector: 'app-perfil-crianca',
  imports: [
    RouterLink,
    MatButtonModule,
    MatTabsModule,
    Carregando,
    EstadoErro,
    EstadoVazio,
    ChecklistCrianca,
    AtendimentosCrianca,
  ],
  templateUrl: './perfil-crianca.html',
  styleUrl: './perfil-crianca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilCrianca implements OnInit {
  private readonly cadastro = inject(CadastroServico);
  private readonly rota = inject(ActivatedRoute);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly perfil = signal<CriancaPerfil | null>(null);
  readonly beneficios = signal<BeneficioCatalogo[]>([]);
  readonly rotuloStatus = rotuloStatus;
  readonly formatarCpf = formatarCpf;
  readonly formatarTelefone = formatarTelefone;
  readonly aba = signal(0);

  ngOnInit(): void {
    if (this.rota.snapshot.queryParamMap?.get('aba') === 'documentos') {
      this.aba.set(1);
    }
    void this.carregar();
  }

  nascimento(valor: string | null): string {
    const data = this.dataLegivel(valor);
    if (!valor || data === 'Não informado') {
      return data;
    }

    const idade = idadeEmAnos(valor);
    return idade === null ? data : `${data} (${rotuloIdade(idade)})`;
  }

  beneficio(ficha: CriancaPerfil): string {
    const rotulo = rotuloBeneficio(ficha.recebe_beneficio);
    if (ficha.recebe_beneficio !== 'recebe') {
      return rotulo;
    }

    return `${rotulo} (${this.nomesDosBeneficios()})`;
  }

  nomesDosBeneficios(): string {
    const ids = new Set(this.perfil()?.beneficios ?? []);
    const nomes = this.beneficios()
      .filter((item) => ids.has(item.id))
      .map((item) => item.nome);
    return nomes.length > 0 ? nomes.join(', ') : 'Nenhum benefício selecionado';
  }

  dataLegivel(valor: string | null): string {
    if (!valor) {
      return 'Não informado';
    }

    const [ano, mes, dia] = valor.split('-');
    if (!ano || !mes || !dia) {
      return 'Não informado';
    }

    return `${dia}/${mes}/${ano}`;
  }

  texto(valor: string | null | undefined): string {
    return valor && valor.trim().length > 0 ? valor : 'Não informado';
  }

  private async carregar(): Promise<void> {
    const id = this.rota.snapshot.paramMap.get('id');
    if (!id) {
      this.erro.set('Cadastro não encontrado.');
      this.carregando.set(false);
      return;
    }

    try {
      const [perfil, beneficios] = await Promise.all([
        this.cadastro.obter(id),
        this.cadastro.listarBeneficios(),
      ]);
      this.beneficios.set(beneficios);
      if (!perfil) {
        this.erro.set('Cadastro não encontrado.');
        return;
      }

      this.perfil.set(perfil);
    } catch (erro: unknown) {
      this.erro.set(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.carregando.set(false);
    }
  }
}
