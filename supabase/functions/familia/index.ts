import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

const CABECALHOS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MENSAGENS = [
  'Operação não autorizada.',
  'Este link não está mais válido.',
  'Este link não aceita mais alterações.',
  'Este link atingiu o limite de envios.',
  'Muitos envios em pouco tempo. Aguarde alguns minutos.',
  'O arquivo já foi promovido.',
  'Cadastro não encontrado.',
  'Tipo de documento não encontrado.',
  'Informe o nome do arquivo.',
  'Envie um PDF, JPEG ou PNG.',
  'O arquivo deve ter até 10 MB.',
  'Informe o nome da criança.',
  'Informe o nome do responsável.',
  'O CPF deve ter 11 dígitos.',
  'O telefone deve ter DDD e número.',
  'Informe um e-mail válido.',
  'Informe uma data válida.',
  'Situação da criança não reconhecida.',
  'Situação de benefício não reconhecida.',
  'O parentesco pode ter no máximo 80 caracteres.',
  'Selecione ao menos um benefício.',
  'Benefício não reconhecido.',
  'O servidor ainda não está configurado.',
];

Deno.serve(async (requisicao) => {
  if (requisicao.method === 'OPTIONS') {
    return new Response('ok', { headers: CABECALHOS });
  }

  if (requisicao.method !== 'POST') {
    return json({ mensagem: 'Não foi possível concluir a operação. Tente novamente.' }, 405);
  }

  try {
    const corpo = await requisicao.json();
    const acao = corpo?.acao;
    if (acao === 'consultar') {
      return await consultar(corpo?.token);
    }
    if (acao === 'enviar-cadastro') {
      return await enviarCadastro(corpo?.token, corpo?.dados);
    }
    if (acao === 'reservar') {
      return await reservar(corpo);
    }
    if (acao === 'confirmar') {
      return await confirmar(corpo);
    }
    if (acao === 'promover') {
      return await promover(requisicao, corpo?.versaoId);
    }
    return json({ mensagem: 'Não foi possível concluir a operação. Tente novamente.' }, 400);
  } catch (erro) {
    return json({ mensagem: mensagemDe(erro) }, 400);
  }
});

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });
}

function admin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !chave) {
    throw new Error('O servidor ainda não está configurado.');
  }

  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mensagemDe(erro: unknown): string {
  const texto = textoDoErro(erro);
  return MENSAGENS.find((item) => texto.includes(item)) ??
    'Não foi possível concluir a operação. Tente novamente.';
}

function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }
  if (erro && typeof erro === 'object' && 'message' in erro && typeof erro.message === 'string') {
    return erro.message;
  }
  return '';
}

function mimeDoConteudo(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

async function consultar(token: unknown): Promise<Response> {
  const cliente = admin();
  const { data, error } = await cliente.rpc('descrever_link_familia', { p_token: token });
  if (error) {
    return json({ valido: false, mensagem: mensagemDe(error) }, 200);
  }
  return json(data, 200);
}

async function enviarCadastro(token: unknown, dados: unknown): Promise<Response> {
  const cliente = admin();
  const { error } = await cliente.rpc('receber_cadastro_familia', {
    p_token: token,
    p_dados: dados ?? {},
  });
  if (error) {
    return json({ mensagem: mensagemDe(error) }, 400);
  }
  return json(
    { recebido: true, mensagem: 'Recebemos o envio. A equipe do Instituto vai conferir.' },
    200,
  );
}

async function reservar(corpo: {
  token?: unknown;
  finalidade?: unknown;
  tipoId?: unknown;
  mime?: unknown;
}): Promise<Response> {
  const cliente = admin();
  const { data, error } = await cliente.rpc('reservar_arquivo_familia', {
    p_token: corpo.token,
    p_finalidade: corpo.finalidade,
    p_tipo: corpo.tipoId,
    p_mime: corpo.mime,
  });
  if (error || !data?.caminho) {
    return json({ mensagem: mensagemDe(error) }, 400);
  }

  const upload = await cliente.storage.from('documentos').createSignedUploadUrl(data.caminho);
  if (upload.error || !upload.data?.token) {
    return json({ mensagem: 'Não foi possível concluir a operação. Tente novamente.' }, 400);
  }

  return json({ caminho: data.caminho, tokenUpload: upload.data.token }, 200);
}

async function confirmar(corpo: {
  token?: unknown;
  finalidade?: unknown;
  tipoId?: unknown;
  caminho?: unknown;
  nome?: unknown;
}): Promise<Response> {
  if (typeof corpo.caminho !== 'string' || !corpo.caminho.startsWith('quarentena/')) {
    return json({ mensagem: 'Este link não está mais válido.' }, 400);
  }

  const cliente = admin();
  const arquivo = await cliente.storage.from('documentos').download(corpo.caminho);
  if (arquivo.error || !arquivo.data) {
    return json({ mensagem: 'Não foi possível concluir a operação. Tente novamente.' }, 400);
  }

  const bytes = new Uint8Array(await arquivo.data.arrayBuffer());
  const mime = mimeDoConteudo(bytes);
  if (bytes.byteLength <= 0 || bytes.byteLength > TAMANHO_MAXIMO || !mime) {
    await cliente.storage.from('documentos').remove([corpo.caminho]);
    return json(
      {
        mensagem: !mime
          ? 'O conteúdo do arquivo não corresponde a PDF, JPEG ou PNG.'
          : 'O arquivo deve ter até 10 MB.',
      },
      400,
    );
  }

  const { error } = await cliente.rpc('confirmar_arquivo_familia', {
    p_token: corpo.token,
    p_finalidade: corpo.finalidade,
    p_tipo: corpo.tipoId,
    p_caminho: corpo.caminho,
    p_nome: corpo.nome,
    p_mime: mime,
    p_tamanho: bytes.byteLength,
  });
  if (error) {
    await cliente.storage.from('documentos').remove([corpo.caminho]);
    return json({ mensagem: mensagemDe(error) }, 400);
  }

  return json({ recebido: true }, 200);
}

async function promover(requisicao: Request, versaoId: unknown): Promise<Response> {
  if (!(await funcionarioAtivo(requisicao))) {
    return json({ mensagem: 'Operação não autorizada.' }, 403);
  }
  if (typeof versaoId !== 'string') {
    return json({ mensagem: 'Cadastro não encontrado.' }, 400);
  }

  const cliente = admin();
  const { data, error } = await cliente
    .from('versoes_documento')
    .select('id, caminho, tipo_mime, documento_id, documentos(crianca_id)')
    .eq('id', versaoId)
    .maybeSingle();

  if (error || !data || typeof data.caminho !== 'string' || !data.caminho.startsWith('quarentena/')) {
    return json({ mensagem: error ? mensagemDe(error) : 'O arquivo já foi promovido.' }, 400);
  }

  const documento = data.documentos as { crianca_id?: string } | { crianca_id?: string }[] | null;
  const criancaId = Array.isArray(documento) ? documento[0]?.crianca_id : documento?.crianca_id;
  const extensao = data.tipo_mime === 'application/pdf' ? 'pdf' : data.tipo_mime === 'image/jpeg' ? 'jpg' : 'png';
  if (!criancaId || !data.documento_id) {
    return json({ mensagem: 'Cadastro não encontrado.' }, 400);
  }

  const destino = `${criancaId}/${data.documento_id}/${data.id}.${extensao}`;
  const copia = await cliente.storage.from('documentos').copy(data.caminho, destino);
  if (copia.error) {
    return json({ mensagem: 'Não foi possível concluir a operação. Tente novamente.' }, 400);
  }

  const conclusao = await cliente.rpc('concluir_promocao_quarentena', {
    p_versao: versaoId,
    p_caminho: destino,
  });
  if (conclusao.error) {
    await cliente.storage.from('documentos').remove([destino]);
    return json({ mensagem: mensagemDe(conclusao.error) }, 400);
  }

  await cliente.storage.from('documentos').remove([data.caminho]);
  return json({ recebido: true }, 200);
}

async function funcionarioAtivo(requisicao: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const autorizacao = requisicao.headers.get('Authorization') ?? '';
  if (!url || !anon || !autorizacao.toLowerCase().startsWith('bearer ')) {
    return false;
  }

  const cliente = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await cliente.rpc('eh_funcionario_ativo');
  return !error && data === true;
}
