import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-estado-vazio',
  templateUrl: './estado-vazio.html',
  styleUrl: './estado-vazio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoVazio {
  readonly titulo = input.required<string>();
  readonly descricao = input.required<string>();
}
