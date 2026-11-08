import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable()
export class TituloInstituto extends TitleStrategy {
  private readonly titulo = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const trecho = this.buildTitle(snapshot);
    this.titulo.setTitle(trecho ? `${trecho} · Instituto Raio de Sol` : 'Instituto Raio de Sol');
  }
}
