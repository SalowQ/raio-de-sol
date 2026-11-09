import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OPCOES_PARENTESCO, TAMANHO_MAXIMO_PARENTESCO } from '../../validators/parentesco';

@Component({
  selector: 'app-campo-parentesco',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './campo-parentesco.html',
  styleUrl: './campo-parentesco.scss',
})
export class CampoParentesco {
  readonly controle = input.required<FormControl<string | null>>();
  readonly controleOutro = input.required<FormControl<string | null>>();
  readonly opcoes = OPCOES_PARENTESCO;
  readonly tamanhoMaximo = TAMANHO_MAXIMO_PARENTESCO;
}
