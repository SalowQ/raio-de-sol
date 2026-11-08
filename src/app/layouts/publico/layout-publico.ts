import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout-publico',
  imports: [RouterOutlet],
  templateUrl: './layout-publico.html',
  styleUrl: './layout-publico.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutPublico {}
