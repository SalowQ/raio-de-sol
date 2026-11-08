import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

@Component({
  selector: 'app-documentos',
  imports: [EstadoVazio],
  template: `
    <app-estado-vazio
      titulo="Documentos"
      descricao="O envio e a validação de documentos ainda estão em preparação."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Documentos {}
