/*
 * Proxy Verified by GS1 su Cloudflare Workers.
 * Il browser chiama /api/vbg/<chiave>/ e il Worker inoltra a https://api.vbg.gs1it.org/v2/<chiave>/
 * aggiungendo il token, che resta un secret di Cloudflare (`wrangler secret put VBG_API_TOKEN`).
 */

type Env = {
  VBG_API_TOKEN: string
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
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
