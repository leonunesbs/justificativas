import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { CLERK_PLAN_SLUG, isFreeAccessActive } from '@/lib/billing';
import { mapearSolicitacao } from '@/lib/fastmedic';

// Precisa de Node (cookie jar via getSetCookie, sem cache) — nunca rodar no Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Constantes do FastMedic Ceará (portadas de FASTMEDIC/collect_data.py)
// ---------------------------------------------------------------------------
const BASE = 'https://saude.fastmedic.com.br/ceara';
const ORIGIN = 'https://saude.fastmedic.com.br';
const LOGIN_URL = `${BASE}/Login?ReturnUrl=%2fceara%2fcleito`;
const REFERER_GRID = `${BASE}/Cleito/SolicitacaoLeito/SolicitacaoLeitoInicial`;
const COD_MODULO = 13;
const COD_REGIONAL = 232440; // ADS 01 - Fortaleza (HGF)
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
const TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Validação da requisição vinda do front
// ---------------------------------------------------------------------------
const RequestSchema = z.object({
  cpf: z
    .string()
    .trim()
    .min(1, 'Informe o CPF do FastMedic.')
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().min(1, 'CPF inválido.')),
  senha: z.string().min(1, 'Informe a senha do FastMedic.'),
  cod: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().regex(/^\d+$/, 'Número do FASTMEDIC inválido.')),
});

// Erro com status HTTP para devolver mensagens úteis ao usuário.
class FastmedicError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Cookie jar + fetch (o fetch do Node não persiste cookies entre chamadas)
// ---------------------------------------------------------------------------
type Jar = Map<string, string>;

function getSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function storeCookies(jar: Jar, res: Response): void {
  for (const sc of getSetCookies(res)) {
    const pair = sc.split(';', 1)[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) jar.set(name, value);
  }
}

function cookieHeader(jar: Jar): string {
  return Array.from(jar, ([k, v]) => `${k}=${v}`).join('; ');
}

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

// Faz a requisição injetando os cookies do jar e seguindo redirects manualmente
// (acumulando Set-Cookie a cada hop, como o httpx com follow_redirects=True).
async function jarFetch(jar: Jar, url: string, init: FetchInit): Promise<Response> {
  let currentUrl = url;
  let method = init.method ?? 'GET';
  let body = init.body;
  const headers: Record<string, string> = { ...init.headers };

  for (let hop = 0; hop < 6; hop++) {
    const reqHeaders: Record<string, string> = { ...headers };
    const cookie = cookieHeader(jar);
    if (cookie) reqHeaders.cookie = cookie;

    const res = await fetch(currentUrl, {
      method,
      headers: reqHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    storeCookies(jar, res);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).toString();
      const wasBody = method !== 'GET' && method !== 'HEAD';
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && wasBody)) {
        method = 'GET';
        body = undefined;
        delete headers['Content-Type'];
      }
      continue;
    }
    return res;
  }
  throw new FastmedicError('Muitos redirecionamentos ao acessar o FastMedic.', 502);
}

async function readJson<T>(res: Response, contexto: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new FastmedicError(`Resposta inesperada do FastMedic (${contexto}).`, 502);
  }
}

function primeiro<T>(arr: T[] | null | undefined, erro: string): T {
  if (!Array.isArray(arr) || arr.length === 0) throw new FastmedicError(erro, 502);
  return arr[0] as T;
}

// ---------------------------------------------------------------------------
// Fluxo de autenticação (GET login → ValidaSenha → combos → Desbloquear)
// Retorna o CodFces (estabelecimento) necessário para o BuscaGridSolicitacao.
// ---------------------------------------------------------------------------
type Envelope<T> = { Sucesso?: boolean; Mensagem?: string | null; Resultado?: T };
type Combo = { Codigo: number; Descricao?: string | null };

const FORM_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Content-Type': 'application/x-www-form-urlencoded',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: LOGIN_URL,
  Origin: ORIGIN,
};

const JSON_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: LOGIN_URL,
};

async function autenticar(jar: Jar, cpf: string, senha: string, onStep: (message: string) => void): Promise<number> {
  // 1) GET na página de login → token antiforgery + cookies de sessão.
  onStep('Conectando ao FastMedic…');
  const loginRes = await jarFetch(jar, LOGIN_URL, {
    method: 'GET',
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  const html = await loginRes.text();
  const token = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1];
  if (!token) throw new FastmedicError('Não foi possível iniciar a sessão no FastMedic.', 502);

  // 2) POST ValidaSenha (form-encoded).
  onStep('Validando CPF e senha…');
  const validaRes = await jarFetch(jar, `${BASE}/Login/ValidaSenha`, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      __RequestVerificationToken: token,
      login: cpf,
      senha,
      CodModulo: String(COD_MODULO),
      session: crypto.randomUUID(),
    }).toString(),
  });
  const valida = await readJson<Envelope<{ CodProfissional?: number }>>(validaRes, 'ValidaSenha');
  if (!valida.Sucesso || !valida.Resultado?.CodProfissional) {
    throw new FastmedicError(valida.Mensagem || 'CPF ou senha inválidos.', 401);
  }
  const codProf = valida.Resultado.CodProfissional;
  onStep('Carregando perfil (município e unidade)…');

  // Combos do perfil (JSON). Cada um devolve um array; usamos o primeiro item.
  const postJson = async (path: string, payload: Record<string, unknown>) => {
    const res = await jarFetch(jar, `${BASE}${path}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new FastmedicError(`Falha no login do FastMedic (${path}).`, 502);
    return readJson<Combo[]>(res, path);
  };

  const municipios = await postJson('/Login/RetornaMunicipioProfissional', {
    codProfissional: codProf,
    codModulo: COD_MODULO,
    session: crypto.randomUUID(),
  });
  const codMunicipio = primeiro(municipios, 'Nenhum município no perfil do FastMedic.').Codigo;

  const fces = await postJson('/Login/RetornaFcesProfissional', {
    codMunicipio: String(codMunicipio),
    codProfissional: codProf,
    codModulo: COD_MODULO,
    session: crypto.randomUUID(),
  });
  const codEstab = primeiro(fces, 'Nenhum estabelecimento no perfil do FastMedic.').Codigo;

  const ocupacoes = await postJson('/Login/RetornaOcupacaoProfissional', {
    codProfissional: codProf,
    codEstabelecimento: String(codEstab),
    session: crypto.randomUUID(),
  });
  const codCbos = primeiro(ocupacoes, 'Nenhuma ocupação no perfil do FastMedic.').Codigo;

  const submodulos = await postJson('/Login/RetornaSubModuloSistema', {
    codEstabelecimento: String(codEstab),
    codModulo: COD_MODULO,
    session: crypto.randomUUID(),
  });
  const codSub = (
    submodulos.find((s) => (s.Descricao ?? '').toUpperCase().includes('CENTRAL')) ??
    primeiro(submodulos, 'Nenhum submódulo no perfil do FastMedic.')
  ).Codigo;

  // 3) POST Desbloquear (form-encoded) → libera a sessão para a Central de Leito.
  onStep('Liberando acesso à Central de Leito…');
  const desbloqRes = await jarFetch(jar, `${BASE}/Login/Desbloquear`, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      CodModulo: String(COD_MODULO),
      Login: cpf,
      Senha: senha,
      CodProfissional: String(codProf),
      CodMunicipio: String(codMunicipio),
      CodEstabelecimento: String(codEstab),
      CodCbos: String(codCbos),
      CodSubModulo: String(codSub),
      CodMunicipioCliente: String(codMunicipio),
      CodProvedor: '0',
      session: crypto.randomUUID(),
      __RequestVerificationToken: token,
    }).toString(),
  });
  const desbloq = await readJson<Envelope<{ NomeProfissional?: string; NomeEstabelecimento?: string }>>(
    desbloqRes,
    'Desbloquear',
  );
  if (!desbloq.Sucesso) {
    throw new FastmedicError(desbloq.Mensagem || 'Não foi possível desbloquear a sessão no FastMedic.', 401);
  }
  const nome = desbloq.Resultado?.NomeProfissional?.trim();
  const estab = desbloq.Resultado?.NomeEstabelecimento?.trim();
  onStep(nome ? `Autenticado: ${nome}${estab ? ` @ ${estab}` : ''}` : 'Sessão autenticada.');
  return codEstab;
}

// ---------------------------------------------------------------------------
// Busca a solicitação pelo número via BuscaGridSolicitacao.
// Passa CodSolicitacaoLeito (quando a API honra, devolve só 1) + janela ampla;
// de qualquer forma o filtro final por CodSolicitacao é feito em mapearSolicitacao.
// ---------------------------------------------------------------------------
function fmtData(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function buscarSolicitacao(jar: Jar, codFces: number, cod: string): Promise<unknown> {
  const agora = new Date();
  const fim = new Date(agora.getTime() + 24 * 60 * 60 * 1000); // +1 dia de margem
  const inicio = new Date(agora.getFullYear() - 8, 0, 1); // janela ampla p/ solicitações antigas

  const body = {
    IndSituacao: -1,
    DataDe: 0,
    CodSolicitacaoLeito: Number(cod),
    DatInicial: fmtData(inicio),
    DatFinal: fmtData(fim),
    IndPrioridade: 0,
    IndFces: 0,
    CodFces: codFces,
    CodUsuario: null,
    CodRegional: COD_REGIONAL,
    CodMunicipio: 0,
    CodTipoLeito: 0,
    CodEspcLeito: 0,
    IndTipoSolicitacao: -1,
    IndCovid: false,
    IndGestante: false,
    IndSindromeGripal: false,
    dtUltimaPesquisa: fmtData(inicio).replace(' ', ', '),
    session: crypto.randomUUID(),
  };

  const res = await jarFetch(jar, `${BASE}/Cleito/SolicitacaoLeito/BuscaGridSolicitacao`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, Referer: REFERER_GRID, Origin: ORIGIN },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new FastmedicError(`Falha ao consultar a solicitação (HTTP ${res.status}).`, 502);
  return readJson<unknown>(res, 'BuscaGridSolicitacao');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: Request): Promise<Response> {
  // Gate de acesso: só usuários autenticados e com assinatura ativa.
  // Exceção: durante o período promocional fica liberado para todos (sem login
  // nem assinatura) — ver `isFreeAccessActive`/`FREE_ACCESS_UNTIL`.
  const { userId, has } = await auth();
  if (!isFreeAccessActive()) {
    if (!userId) {
      return NextResponse.json({ error: 'Entre na sua conta para usar a busca no FastMedic.' }, { status: 401 });
    }
    if (!has({ plan: CLERK_PLAN_SLUG })) {
      return NextResponse.json(
        { error: 'Assinatura inativa. Ative um plano para liberar a busca no FastMedic.' },
        { status: 403 },
      );
    }
  }

  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { cpf, senha, cod } = parsed.data;

  // Resposta em NDJSON (um evento JSON por linha) para o front acompanhar o
  // fluxo de autenticação ao vivo: { type: 'log' | 'result' | 'error' }.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const jar: Jar = new Map();
        const codFces = await autenticar(jar, cpf, senha, (message) => send({ type: 'log', message }));
        send({ type: 'log', message: `Consultando solicitação ${cod}…` });
        const json = await buscarSolicitacao(jar, codFces, cod);
        const result = mapearSolicitacao(json, cod);
        if (!result) {
          send({ type: 'error', message: `Solicitação ${cod} não encontrada no FastMedic.` });
        } else {
          send({ type: 'result', result });
        }
      } catch (err) {
        const message =
          err instanceof FastmedicError
            ? err.message
            : err instanceof Error && err.name === 'TimeoutError'
              ? 'O FastMedic demorou para responder. Tente novamente.'
              : 'Falha ao consultar o FastMedic.';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
