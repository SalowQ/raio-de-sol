import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

@Component({
  selector: 'app-historico',
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      titulo="Histórico"
      descricao="O histórico de atividades ainda está em preparação."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Historico {}
