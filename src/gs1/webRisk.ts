/*
 * Controllo del link negli elenchi di siti malevoli di Google (Web Risk), tramite il Worker che
 * custodisce la chiave. Se la chiave non è configurata il Worker risponde checked: false.
 */
import { t } from '../i18n'

const VBG_BASE = import.meta.env.VITE_VBG_BASE ?? '/api/vbg'
const ENDPOINT = VBG_BASE.replace(/\/api\/vbg\/?$/, '/api/linkcheck')

export type WebRiskResult = { checked: boolean; threats: string[] }

const labels: Record<string, string> = {
  get MALWARE() { return t('software dannoso (malware)') },
  get SOCIAL_ENGINEERING() { return t('phishing o truffa') },
  get UNWANTED_SOFTWARE() { return t('software indesiderato') },
}

export function threatLabel(type: string) {
  return labels[type] ?? type.toLowerCase()
}

const cache = new Map<string, Promise<WebRiskResult>>()

export function checkWebRisk(url: string): Promise<WebRiskResult> {
  const hit = cache.get(url)
  if (hit) return hit
  const request = fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
    .then(async (res) => (res.ok ? ((await res.json()) as WebRiskResult) : { checked: false, threats: [] }))
    .catch(() => ({ checked: false, threats: [] }))
  cache.set(url, request)
  return request
}
