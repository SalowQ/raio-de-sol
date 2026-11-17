import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Tema } from '../../../core/tema';

@Component({
  selector: 'app-botao-tema',
  templateUrl: './botao-tema.html',
  styleUrl: './botao-tema.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotaoTema {
  readonly tema = inject(Tema);
}
