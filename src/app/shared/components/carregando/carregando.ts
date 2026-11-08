import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-carregando',
  imports: [MatProgressSpinnerModule],
  templateUrl: './carregando.html',
  styleUrl: './carregando.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Carregando {
  readonly rotulo = input('Carregando');
}
