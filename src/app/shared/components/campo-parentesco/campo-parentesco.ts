import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TAMANHO_MAXIMO_PARENTESCO } from '../../validators/parentesco';

@Component({
  selector: 'app-campo-parentesco',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './campo-parentesco.html',
  styleUrl: './campo-parentesco.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoParentesco {
  readonly controle = input.required<FormControl<string | null>>();
  readonly tamanhoMaximo = TAMANHO_MAXIMO_PARENTESCO;
}
