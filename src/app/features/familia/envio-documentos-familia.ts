import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Carregando } from '../../shared/components/carregando/carregando';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { FamiliaServico, type TipoLink } from './familia-servico';

@Component({
  selector: 'app-envio-documentos-familia',
  imports: [MatButtonModule, Carregando, EstadoErro],
  templateUrl: './envio-documentos-familia.html',
  styleUrl: './formulario-familia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvioDocumentosFamilia implements OnInit {
  private readonly familia = inject(FamiliaServico);
  private readonly rota = inject(ActivatedRoute);

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly recebido = signal(false);
  readonly tipos = signal<TipoLink[]>([]);
  readonly arquivos = signal<ReadonlyMap<string, File>>(new Map());
  private token = '';

  ngOnInit(): void {
    this.token = this.rota.snapshot.paramMap.get('token') ?? '';
    void this.carregar();
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

  async enviar(): Promise<void> {
    if (this.arquivos().size === 0 || this.enviando()) {
      this.erro.set('Escolha ao menos um arquivo.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    const falhas: string[] = [];
    for (const [tipoId, arquivo] of this.arquivos()) {
      const tipo = this.tipos().find((item) => item.id === tipoId);
      try {
        await this.familia.enviarArquivo(this.token, 'documentos', tipoId, arquivo);
        this.arquivos.update((atual) => {
          const proximo = new Map(atual);
          proximo.delete(tipoId);
          return proximo;
        });
      } catch (erro: unknown) {
        const mensagem = erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';
        falhas.push(`${tipo?.nome ?? 'Documento'}: ${mensagem}`);
      }
    }

    this.recebido.set(true);
    this.erro.set(falhas.length > 0 ? falhas.join(' ') : null);
    this.enviando.set(false);
  }

  private async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const consulta = await this.familia.consultar(this.token);
      if (!consulta.valido || consulta.finalidade !== 'documentos') {
        this.erro.set(consulta.mensagem ?? 'Este link não está mais válido.');
        return;
      }
      this.tipos.set(consulta.tipos ?? []);
      this.erro.set(null);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      this.carregando.set(false);
    }
  }
}
