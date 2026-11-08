import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TratamentoErros {
  mensagemAmigavel(erro: unknown): string {
    switch (this.codigo(erro)) {
      case 'invalid_credentials':
      case 'invalid_grant':
        return 'E-mail ou senha incorretos.';
      case 'email_not_confirmed':
        return 'Confirme o e-mail antes de entrar.';
      case 'over_request_rate_limit':
      case 'too_many_requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
      case 'user_banned':
        return 'Esta conta está desativada. Procure a administração do Instituto.';
      case 'weak_password':
        return 'A senha precisa ter pelo menos 8 caracteres.';
      default:
        return 'Não foi possível concluir a operação. Tente novamente.';
    }
  }

  /** Recuperação de senha não revela se o e-mail existe. */
  contaAusente(erro: unknown): boolean {
    return this.codigo(erro) === 'user_not_found';
  }

  private codigo(erro: unknown): string | null {
    if (!erro || typeof erro !== 'object') {
      return null;
    }

    const registro = erro as Record<string, unknown>;
    const codigo = registro['code'] ?? registro['error_code'];
    return typeof codigo === 'string' ? codigo : null;
  }
}
