/*
 * Client per l'API Verified by GS1 di GS1 Italy (https://api.vbg.gs1it.org/v2).
 * Il browser chiama `/api/vbg`: il proxy (vite.config.ts) aggiunge il token lato server,
 * perché l'API non abilita il CORS e il token non deve finire nel bundle.
 */

import { lang, locale, t } from '../i18n'
const BASE = import.meta.env.VITE_VBG_BASE ?? '/api/vbg'

export type VbgLink = { label: string; title: string; href: string }

export type Licensee = {
  name: string
  /** GS1 Company Prefix (licenza) del titolare. */
  prefix?: string
  mo?: string
  gln?: string
  website?: string
  address?: string
  /** Stato della licenza GS1 come lo riporta Verified by GS1 (es. ACTIVE, INACTIVE), se presente. */
  status?: string
}

export type Verification = {
  state: 'verified' | 'licensed' | 'invalid' | 'error'
  /** Il titolare ha pubblicato tutti i 7 attributi essenziali. */
  complete?: boolean
  recordStatus?: string
  gtin?: string
  name?: string
  brand?: string
  image?: string
  netContent?: string
  /** Codice brick GPC e nome italiano (classificazione GPC pubblicata da GS1 Italy). */
  category?: string
  categoryName?: string
  categorySegment?: string
  countries?: string
  updated?: string
  licensee?: Licensee
  links: VbgLink[]
  message?: string
  /** Codice di errore GS1 (es. E039 = numero non assegnato). */
  code?: string
}

type Lang = { language: string; value: string }
type RawLicence = {
  licenseeName: string
  licenceStatus?: string
  status?: string
  licenceKey?: string
  licenseeGLN?: string
  licensingMO?: { moName: string }
  contactPoint?: { website?: string }[]
  address?: Record<string, Lang | string | undefined>
}
type RawLinkTarget = { href: string; title: string; hreflang?: string[]; context?: string[] }
type RawRecord = {
  gtin?: string
  gtinRecordStatus?: string
  keyRecordStatus?: string
  gpcCategoryCode?: string
  brandName?: Lang[]
  productDescription?: Lang[]
  productImageUrl?: Lang[]
  netContent?: { unitCode: string; value: string }[]
  countryOfSaleCode?: { alpha2?: string; numeric: string }[]
  dateUpdated?: string
  isComplete?: boolean
  gs1Licence?: RawLicence
  linkset?: Record<string, RawLinkTarget[] | string>[]
  glnRecords?: { organizationName?: Lang[] }[]
  code?: number
  validationErrors?: { errors: { errorCode: string; message: string }[] }[]
}

/** AI della chiave primaria → endpoint dell'API. */
const endpoints: Record<string, string> = {
  '01': 'gtin',
  '414': 'gln',
  '417': 'gln',
  '00': 'sscc',
  '8003': 'grai',
  '8004': 'giai',
  '8017': 'gsrn',
  '8018': 'gsrn',
  '253': 'gdti',
  '401': 'ginc',
  '402': 'gsin',
  '255': 'gcn',
  '8010': 'cpid',
  '8013': 'gmn',
  '8006': 'itip',
}

export function canVerify(ai: string | undefined) {
  return Boolean(ai && endpoints[ai])
}

/** Messaggi degli errori GS1 più comuni, tradotti al momento dell'uso. */
const errorMessage = (code: string) =>
  ({
    E002: t('La cifra di controllo non è corretta: il numero è stato letto o digitato male.'),
    E030: t('Numero riservato a uso interno (circolazione ristretta): non identifica un prodotto nel mercato aperto.'),
    E037: t('Numero riservato ai coupon: non identifica un prodotto.'),
    E039: t('Il numero non risulta assegnato da GS1 a nessuna azienda.'),
  })[code]

/** Segna un testo da tradurre senza tradurlo subito. */
const k = (s: string) => s

const linkLabels: Record<string, string> = {
  pip: k('Informazioni prodotto'),
  hasRetailers: k('Dove acquistare'),
  recipeInfo: k('Ricette'),
  productSustainabilityInfo: k('Sostenibilità'),
  whatsInTheBox: k('Contenuto della confezione'),
  epil: k('Foglietto illustrativo'),
  smpc: k('Riassunto caratteristiche prodotto'),
  instructions: k('Istruzioni'),
  allergenInfo: k('Allergeni'),
  nutritionalInfo: k('Valori nutrizionali'),
  promotion: k('Promozioni'),
  support: k('Assistenza'),
  review: k('Recensioni'),
  certificationInfo: k('Certificazioni'),
  safetyInfo: k('Sicurezza'),
  traceability: k('Tracciabilità'),
  defaultLink: k('Sito del prodotto'),
  relatedVideo: k('Video'),
  socialMedia: k('Social'),
  recallStatus: k('Richiami'),
  registerProduct: k('Registra il prodotto'),
  faqs: k('Domande frequenti'),
  quickStartGuide: k('Guida rapida'),
  sustainabilityInfo: k('Sostenibilità'),
}

const units: Record<string, string> = { GRM: 'g', KGM: 'kg', MGM: 'mg', MLT: 'ml', CLT: 'cl', LTR: 'l', H87: 'pz', MTR: 'm', CMT: 'cm', MMT: 'mm', MTK: 'm²', MTQ: 'm³' }

/** Nome del paese nella lingua corrente. */
const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames([locale()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
const unit = (code: string) => (code === 'H87' ? t('pz') : units[code] ?? code)

/** Preferisce la lingua dell'interfaccia, poi l'altra (italiano / inglese), poi la prima disponibile. */
const preferred = () => (lang() === 'en' ? [/^en/i, /^it/i] : [/^it/i, /^en/i])
function pick(values?: Lang[]) {
  if (!values?.length) return undefined
  const [first, second] = preferred()
  return (values.find((v) => first.test(v.language)) ?? values.find((v) => second.test(v.language)) ?? values[0]).value
}

function langOf(value: Lang | string | undefined) {
  return typeof value === 'string' ? value : value?.value
}

function formatAddress(address?: RawLicence['address']) {
  if (!address) return undefined
  const street = langOf(address.streetAddress)
  const city = [langOf(address.postalCode as string), langOf(address.addressLocality)].filter(Boolean).join(' ')
  const region = langOf(address.addressRegion)
  const country = typeof address.countryCode === 'string' ? countryName(address.countryCode) : undefined
  return [street, region && city ? `${city} (${region})` : city, country].filter(Boolean).join(', ') || undefined
}

function mapLicensee(licence?: RawLicence): Licensee | undefined {
  if (!licence) return undefined
  return {
    name: licence.licenseeName,
    prefix: licence.licenceKey,
    mo: licence.licensingMO?.moName,
    gln: licence.licenseeGLN,
    website: licence.contactPoint?.find((c) => c.website)?.website,
    address: formatAddress(licence.address),
    status: licence.licenceStatus ?? licence.status,
  }
}

/** Un link per tipo, nella lingua più adatta all'utente italiano. */
function mapLinks(linkset?: RawRecord['linkset']): VbgLink[] {
  const context = linkset?.[0]
  if (!context) return []
  const links: VbgLink[] = []
  for (const [type, targets] of Object.entries(context)) {
    if (!Array.isArray(targets) || !targets.length) continue
    const short = type.split('/').pop() ?? type
    const best =
      targets.find((x) => x.hreflang?.some((l) => preferred()[0].test(l)) || x.context?.includes(lang())) ??
      targets.find((x) => x.hreflang?.some((l) => preferred()[1].test(l))) ??
      targets[0]
    links.push({ label: linkLabels[short] ? t(linkLabels[short]) : best.title, title: best.title, href: best.href })
  }
  return links.slice(0, 8)
}

function mapRecord(record: RawRecord): Verification {
  const issue = record.validationErrors?.[0]?.errors?.[0]
  if (record.code === 5 || issue) {
    return { state: 'invalid', links: [], code: issue?.errorCode, message: (issue && errorMessage(issue.errorCode)) ?? issue?.message ?? t('Il codice non è valido.') }
  }

  const licensee = mapLicensee(record.gs1Licence)
  const links = mapLinks(record.linkset)
  const recordStatus = record.gtinRecordStatus ?? record.keyRecordStatus
  const name = pick(record.productDescription) ?? pick(record.glnRecords?.[0]?.organizationName)

  if (!name || record.glnRecords) {
    return { state: 'licensed', recordStatus, gtin: record.gtin, licensee, links, name: record.glnRecords ? name : undefined }
  }

  return {
    state: 'verified',
    complete: record.isComplete,
    recordStatus,
    gtin: record.gtin,
    name,
    brand: pick(record.brandName),
    image: pick(record.productImageUrl),
    netContent: record.netContent?.map((n) => `${Number(n.value).toLocaleString(locale())} ${unit(n.unitCode)}`).join(' · '),
    category: record.gpcCategoryCode,
    countries: record.countryOfSaleCode?.map((c) => (c.alpha2 ? countryName(c.alpha2) : c.numeric)).join(', '),
    updated: record.dateUpdated ? new Date(record.dateUpdated).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
    licensee,
    links,
  }
}

let gpcPromise: Promise<{ segments: string[]; bricks: Record<string, [string, number]> }> | null = null

/** Nome italiano del brick GPC, dal file pubblicato da GS1 (caricato solo alla prima verifica). */
async function gpcBrick(code: string): Promise<Pick<Verification, 'categoryName' | 'categorySegment'>> {
  try {
    gpcPromise ??= import('../vendor/gs1/gpc-bricks-it.json').then((m) => m.default as unknown as { segments: string[]; bricks: Record<string, [string, number]> })
    const gpc = await gpcPromise
    const brick = gpc.bricks[code]
    return brick ? { categoryName: brick[0], categorySegment: gpc.segments[brick[1]] } : {}
  } catch {
    return {}
  }
}

const cache = new Map<string, Promise<Verification>>()

/** Verifica la chiave primaria nel registro Verified by GS1. Le risposte valide restano in cache per la sessione. */
export function verifyKey(ai: string, value: string): Promise<Verification> {
  const endpoint = endpoints[ai]
  if (!endpoint) return Promise.resolve({ state: 'error', links: [], message: t('Tipo di codice non verificabile.') })
  const key = endpoint === 'gtin' ? value.padStart(14, '0') : value
  const cacheKey = `${lang()}:${endpoint}:${key}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const request = fetch(`${BASE}/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([key]),
  })
    .then(async (res): Promise<Verification> => {
      if (res.status === 401 || res.status === 403) return { state: 'error', links: [], message: t('Il servizio di verifica ha rifiutato l’accesso. Controlla il token API.') }
      if (!res.ok) return { state: 'error', links: [], message: t('Il servizio di verifica non risponde (errore {status}).', { status: res.status }) }
      const [record] = (await res.json()) as RawRecord[]
      if (!record) return { state: 'error', links: [], message: t('Risposta vuota dal servizio di verifica.') }
      const verification = mapRecord(record)
      if (verification.category) Object.assign(verification, await gpcBrick(verification.category))
      return verification
    })
    .catch((): Verification => ({ state: 'error', links: [], message: navigator.onLine ? t('Impossibile raggiungere il servizio di verifica.') : t('Sei offline: la verifica richiede una connessione.') }))

  cache.set(cacheKey, request)
  // Gli errori di rete non vanno in cache, così "Riprova" ritenta davvero.
  void request.then((v) => v.state === 'error' && cache.delete(cacheKey))
  return request
}
