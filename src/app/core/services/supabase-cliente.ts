import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { urlDoProjeto } from './url-do-projeto';

@Injectable({ providedIn: 'root' })
export class SupabaseCliente {
  readonly configurado: boolean;
  readonly cliente: SupabaseClient | null;

  constructor() {
    const url = urlDoProjeto(environment.supabaseUrl);
    const chave = environment.supabaseAnonKey.trim();
    this.configurado = url.length > 0 && chave.length > 0 && !chaveDeServico(chave);
    this.cliente = this.configurado
      ? createClient(url, chave, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  }
}

function chaveDeServico(chave: string): boolean {
  return chave.startsWith('sb_secret_') || chave.includes('service_role');
}
