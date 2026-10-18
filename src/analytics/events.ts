/*
 * Statistiche sulle scansioni: un evento per ogni scansione completata, inviato al Worker
 * (/api/events), che aggiunge la regione da Cloudflare e lo salva su Supabase.
 * Nessun dato personale: niente identificativi, dei link solo il dominio.
 */
import { codeType, gs1Compliance, type Scan } from '../components/scan'
import { assessLink, registrableDomain } from '../gs1/linkSafety'
import { canVerify } from '../gs1/vbg'

export type ScanSource = 'camera' | 'image' | 'manual'

const VBG_BASE = import.meta.env.VITE_VBG_BASE ?? '/api/vbg'
const ENDPOINT = VBG_BASE.replace(/\/api\/vbg\/?$/, '/api/events')

/** Tutti i controlli asincroni (sintassi, VbG, siti malevoli) sono arrivati? */
export function isSettled(scan: Scan) {
  if (scan.kind === 'gs1' && scan.syntax === undefined) return false
  if (canVerify(scan.primary?.ai) && !scan.vbg) return false
  if (scan.url && !scan.webRisk) return false
  return true
}

function coreCount(scan: Scan) {
  const v = scan.vbg
  if (scan.primary?.ai !== '01' || !v || (v.state !== 'verified' && v.state !== 'licensed')) return null
  return [v.gtin, v.brand, v.name, v.image, v.category, v.netContent, v.countries].filter(Boolean).length
}

export function buildEvent(scan: Scan, source: ScanSource) {
  const v = scan.vbg
  const vbgLinkInput = scan.kind === 'gs1' ? (canVerify(scan.primary?.ai) ? v : null) : null
  const link = scan.url ? assessLink(scan.url, vbgLinkInput, scan.webRisk) : null
  const primaryKey = scan.primary ? (scan.primary.ai === '01' ? scan.primary.value.padStart(14, '0') : scan.primary.value) : null

  return {
    source,
    device: window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    app_version: `${__APP_RELEASE__}+${__APP_VERSION__}`,
    symbology: source === 'manual' ? null : codeType(scan).title,
    is_2d: source === 'manual' ? null : Boolean(scan.symbol) || /QR|Matrix|Aztec|PDF417|MaxiCode|Codice con/i.test(scan.format),
    content_kind: scan.kind,
    compliance: gs1Compliance(scan).level,
    check_digit_ok: scan.checkDigit ?? null,
    syntax_ok: scan.syntax ? scan.syntax.ok : null,
    syntax_error: scan.syntax && !scan.syntax.ok ? scan.syntax.original ?? scan.syntax.message ?? null : null,
    primary_ai: scan.primary?.ai ?? null,
    primary_key: primaryKey,
    ai_list: scan.fields.map((f) => f.ai),
    issuer_mo: scan.issuer ?? null,
    vbg_state: v?.state ?? null,
    vbg_complete: v?.complete ?? null,
    vbg_core_count: coreCount(scan),
    vbg_error_code: v?.code ?? null,
    company_prefix: v?.licensee?.prefix ?? null,
    licensee_name: v?.licensee?.name ?? null,
    brand_name: v?.brand ?? null,
    // Stato della scheda (gtinRecordStatus/keyRecordStatus) e della licenza GS1: servono a riconoscere
    // i codici con licenza scaduta o non più attiva.
    vbg_record_status: v?.recordStatus ?? null,
    vbg_licence_status: v?.licensee?.status ?? null,
    licensee_gln: v?.licensee?.gln ?? null,
    licensing_mo: v?.licensee?.mo ?? null,
    gpc_brick: v?.category ?? null,
    gpc_brick_name: v?.categoryName ?? null,
    gpc_segment: v?.categorySegment ?? null,
    link_domain: link ? registrableDomain(link.host) : null,
    link_level: link?.level ?? null,
    link_imitates: link?.imitates ?? null,
    link_threats: scan.webRisk?.threats ?? null,
  }
}

export function sendEvent(scan: Scan, source: ScanSource) {
  const body = JSON.stringify(buildEvent(scan, source))
  // keepalive: l'invio va a buon fine anche se l'utente chiude subito l'app.
  void fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}
