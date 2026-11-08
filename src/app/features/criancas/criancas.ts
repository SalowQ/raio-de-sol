import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

@Component({
  selector: 'app-criancas',
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      titulo="Crianças"
      descricao="A listagem e o cadastro de crianças ainda estão em preparação. O parentesco do responsável é opcional e pode ficar em branco."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Criancas {}
