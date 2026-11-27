import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export interface ConfirmacaoExclusao {
  titulo: string;
  mensagem: string;
  confirmar?: string;
}

@Component({
  selector: 'app-confirmar-exclusao',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirmar-exclusao.html',
  styleUrl: './confirmar-exclusao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmarExclusao {
  readonly dados = inject<ConfirmacaoExclusao>(MAT_DIALOG_DATA);

  rotulo(): string {
    return this.dados.confirmar || 'Excluir';
  }
}

export async function pedirConfirmacao(dialogos: MatDialog, dados: ConfirmacaoExclusao): Promise<boolean> {
  const resultado = await firstValueFrom(
    dialogos
      .open<ConfirmarExclusao, ConfirmacaoExclusao, boolean>(ConfirmarExclusao, {
        data: dados,
        width: '28rem',
        autoFocus: 'first-tabbable',
        panelClass: 'sol-dialogo',
        backdropClass: 'sol-cortina',
      })
      .afterClosed(),
  );
  return resultado === true;
}
