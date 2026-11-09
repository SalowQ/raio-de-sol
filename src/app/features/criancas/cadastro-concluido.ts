import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface CadastroConcluidoDados {
  nome: string;
}

@Component({
  selector: 'app-cadastro-concluido',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './cadastro-concluido.html',
  styleUrl: './cadastro-concluido.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadastroConcluido {
  readonly dados = inject<CadastroConcluidoDados>(MAT_DIALOG_DATA);
}
