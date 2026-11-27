import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ExcluirRegistroDados {
  dia: string;
}

@Component({
  selector: 'app-excluir-registro',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './excluir-registro.html',
  styleUrl: './excluir-registro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcluirRegistro {
  readonly dados = inject<ExcluirRegistroDados>(MAT_DIALOG_DATA);
}
