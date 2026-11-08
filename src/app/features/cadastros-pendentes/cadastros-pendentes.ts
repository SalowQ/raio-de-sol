import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

@Component({
  selector: 'app-cadastros-pendentes',
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      titulo="Cadastros pendentes"
      descricao="A análise dos cadastros enviados pelas famílias ainda está em preparação."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadastrosPendentes {}
