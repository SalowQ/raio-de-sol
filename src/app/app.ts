import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BotaoTema } from './shared/components/botao-tema/botao-tema';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BotaoTema],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
