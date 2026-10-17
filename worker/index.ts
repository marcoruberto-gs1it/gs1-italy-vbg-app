/*
 * Proxy Verified by GS1 su Cloudflare Workers.
 * Il browser chiama /api/vbg/<chiave>/ e il Worker inoltra a https://api.vbg.gs1it.org/v2/<chiave>/
 * aggiungendo il token, che resta un secret di Cloudflare (`wrangler secret put VBG_API_TOKEN`).
 */

type Env = {
  VBG_API_TOKEN: string
  /** Chiave Google Web Risk (facoltativa): senza, il controllo dei siti malevoli risulta "non attivo". */
  WEB_RISK_API_KEY?: string
  /** Statistiche: progetto Supabase e chiave segreta (facoltativi: senza, gli eventi vengono ignorati). */
  SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  ASSETS: Fetcher
  VBG_LIMITER: RateLimit
}

const UPSTREAM = 'https://api.vbg.gs1it.org/v2'
// Solo gli endpoint in lettura usati dall'app.
const KEYS = new Set(['gtin', 'gln', 'sscc', 'grai', 'giai', 'gsrn', 'gdti', 'ginc', 'gsin', 'gcn', 'cpid', 'gmn', 'itip'])
// L'app invia sempre un solo codice per richiesta: niente interrogazioni massive con il token.
const BODY = /^\["[0-9A-Za-z\-.%/]{1,80}"\]$/

// Siti che possono chiamare il proxy da un altro dominio (CORS). L'app servita dal Worker stesso non ne ha bisogno.
const ALLOWED_ORIGINS = new Set(['https://marcoruberto-gs1it.github.io'])

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (request: Request, status: number, message: string) =>
  new Response(JSON.stringify({ detail: message }), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } })

const THREAT_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']

/**
 * POST /api/linkcheck {"url": "..."} → {"checked": bool, "threats": [...]}
 * Interroga Google Web Risk (uris.search) e tiene in cache l'esito per un'ora.
 */
async function linkCheck(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(request)
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json(request, 405, 'Method not allowed')

  const ip = request.headers.get('CF-Connecting-IP') ?? 'anonimo'
  const { success } = await env.VBG_LIMITER.limit({ key: ip })
  if (!success) return json(request, 429, 'Troppe richieste, riprova tra poco')

  let target: string
  try {
    const body = (await request.json()) as { url?: unknown }
    target = typeof body.url === 'string' ? body.url : ''
    const parsed = new URL(target)
    if (!/^https?:$/.test(parsed.protocol) || target.length > 2048) throw new Error()
  } catch {
    return json(request, 400, 'Richiesta non valida')
  }

  if (!env.WEB_RISK_API_KEY) return reply({ checked: false, threats: [] })

  const cacheKey = new Request(`https://cache.internal/linkcheck?u=${encodeURIComponent(target)}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return reply(await cached.json())

  const query = new URLSearchParams({ uri: target, key: env.WEB_RISK_API_KEY })
  THREAT_TYPES.forEach((t) => query.append('threatTypes', t))
  const upstream = await fetch(`https://webrisk.googleapis.com/v1/uris:search?${query}`)
  if (!upstream.ok) return reply({ checked: false, threats: [], error: upstream.status })

  const data = (await upstream.json()) as { threat?: { threatTypes?: string[] } }
  const result = { checked: true, threats: data.threat?.threatTypes ?? [] }
  ctx.waitUntil(caches.default.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Cache-Control': 'max-age=3600' } })))
  return reply(result)
}

/*
 * POST /api/events: una scansione completata, per le statistiche.
 * Si accettano solo i campi previsti; la posizione (paese e regione) la aggiunge il Worker da
 * Cloudflare. L'indirizzo IP non viene salvato.
 */
type FieldRule = 'bool' | 'int' | 'strings' | number // number = lunghezza massima della stringa
const EVENT_FIELDS: Record<string, FieldRule> = {
  source: 10, device: 10, app_version: 40,
  symbology: 40, is_2d: 'bool', content_kind: 10, compliance: 10,
  check_digit_ok: 'bool', syntax_ok: 'bool', syntax_error: 300,
  primary_ai: 4, primary_key: 90, ai_list: 'strings', issuer_mo: 120,
  vbg_state: 10, vbg_complete: 'bool', vbg_core_count: 'int', vbg_error_code: 10,
  company_prefix: 20, licensee_name: 200, licensee_gln: 13, licensing_mo: 80,
  gpc_brick: 10, gpc_brick_name: 200, gpc_segment: 200,
  link_domain: 253, link_level: 10, link_imitates: 253, link_threats: 'strings',
}

function cleanEvent(input: Record<string, unknown>) {
  const row: Record<string, unknown> = {}
  for (const [key, rule] of Object.entries(EVENT_FIELDS)) {
    const value = input[key]
    if (value === undefined || value === null) continue
    if (rule === 'bool' && typeof value === 'boolean') row[key] = value
    else if (rule === 'int' && Number.isInteger(value)) row[key] = value
    else if (rule === 'strings' && Array.isArray(value)) row[key] = value.filter((v) => typeof v === 'string').slice(0, 30).map((v) => v.slice(0, 40))
    else if (typeof rule === 'number' && typeof value === 'string') row[key] = value.slice(0, rule)
  }
  return row
}

async function events(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cors = corsHeaders(request)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json(request, 405, 'Method not allowed')

  const ip = request.headers.get('CF-Connecting-IP') ?? 'anonimo'
  const { success } = await env.VBG_LIMITER.limit({ key: ip })
  if (!success) return json(request, 429, 'Troppe richieste, riprova tra poco')

  const text = await request.text()
  if (text.length > 8000) return json(request, 400, 'Richiesta non valida')
  let row: Record<string, unknown>
  try {
    row = cleanEvent(JSON.parse(text) as Record<string, unknown>)
  } catch {
    return json(request, 400, 'Richiesta non valida')
  }
  if (!row.source) return json(request, 400, 'Richiesta non valida')

  // Posizione a livello di regione, dedotta da Cloudflare (nessun permesso chiesto all'utente).
  const cf = request.cf as IncomingRequestCfProperties | undefined
  row.country = cf?.country ?? null
  row.region_code = cf?.regionCode ?? null
  row.region = cf?.region ?? null
  row.is_eu = cf?.isEUCountry === '1'

  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    // Si risponde subito; la scrittura prosegue in background.
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/scan_events`, {
        method: 'POST',
        headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      }).then(async (res) => {
        if (!res.ok) console.error('Supabase', res.status, await res.text())
      }),
    )
  }
  return new Response(null, { status: 202, headers: cors })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/linkcheck') return linkCheck(request, env, ctx)
    if (url.pathname === '/api/events') return events(request, env, ctx)
    const match = url.pathname.match(/^\/api\/vbg\/([a-z]+)\/$/)
    if (!match) return url.pathname.startsWith('/api/') ? json(request, 404, 'Not found') : env.ASSETS.fetch(request)

    const key = match[1]
    if (!KEYS.has(key)) return json(request, 404, 'Not found')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
    if (request.method !== 'POST') return json(request, 405, 'Method not allowed')
    if (!env.VBG_API_TOKEN) return json(request, 500, 'VBG_API_TOKEN non configurato')

    const ip = request.headers.get('CF-Connecting-IP') ?? 'anonimo'
    const { success } = await env.VBG_LIMITER.limit({ key: ip })
    if (!success) return json(request, 429, 'Troppe richieste, riprova tra poco')

    const body = await request.text()
    if (!BODY.test(body)) return json(request, 400, 'Richiesta non valida')

    const upstream = await fetch(`${UPSTREAM}/${key}/`, {
      method: 'POST',
      headers: { Authorization: `Token ${env.VBG_API_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(request) },
    })
  },
} satisfies ExportedHandler<Env>
