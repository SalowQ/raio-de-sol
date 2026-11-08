import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const producao = process.argv.includes('--producao');
const arquivoEnv = lerEnv(resolve(raiz, '.env'));
const url = urlDoProjeto(process.env.SUPABASE_URL || arquivoEnv.SUPABASE_URL || '');
const chave = (process.env.SUPABASE_ANON_KEY || arquivoEnv.SUPABASE_ANON_KEY || '').trim();

if (!url && !chave) {
  process.exit(0);
}

if (!url || !chave) {
  console.error('Informe SUPABASE_URL e SUPABASE_ANON_KEY juntas.');
  process.exit(1);
}

if (chavePerigosa(chave)) {
  console.error(
    'A chave informada é de serviço. O frontend só pode receber a chave anon ou publishable.',
  );
  process.exit(1);
}

const destino = producao
  ? resolve(raiz, 'src/environments/environment.production.ts')
  : resolve(raiz, 'src/environments/environment.ts');

writeFileSync(destino, conteudo(producao, url, chave), 'utf8');

function conteudo(ehProducao, supabaseUrl, supabaseAnonKey) {
  return `// Gerado por scripts/gerar-ambiente.mjs. A chave anon é pública; a autorização é o RLS.
// Nunca coloque a service_role ou sb_secret neste arquivo.
export const environment = {
  production: ${ehProducao},
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;
}

function lerEnv(caminho) {
  if (!existsSync(caminho)) {
    return {};
  }

  const saida = {};
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) {
      continue;
    }
    const indice = limpa.indexOf('=');
    if (indice === -1) {
      continue;
    }
    const nome = limpa.slice(0, indice).trim();
    let valor = limpa.slice(indice + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    saida[nome] = valor;
  }
  return saida;
}

function urlDoProjeto(url) {
  return url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

function chavePerigosa(chave) {
  if (chave.startsWith('sb_secret_') || chave.includes('service_role')) {
    return true;
  }

  const partes = chave.split('.');
  if (partes.length !== 3) {
    return false;
  }

  try {
    const json = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    return json.role === 'service_role';
  } catch {
    return false;
  }
}
