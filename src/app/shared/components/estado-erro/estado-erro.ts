import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-estado-erro',
  templateUrl: './estado-erro.html',
  styleUrl: './estado-erro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoErro {
  readonly mensagem = input.required<string>();
}
