import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

@Component({
  selector: 'app-presencas',
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      titulo="Presença"
      descricao="O registro de presença ainda está em preparação."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Presencas {}
