/*
 * Client per l'API Verified by GS1 di GS1 Italy (https://api.vbg.gs1it.org/v2).
 * Il browser chiama `/api/vbg`: il proxy (vite.config.ts) aggiunge il token lato server,
 * perché l'API non abilita il CORS e il token non deve finire nel bundle.
 */

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

const errorMessages: Record<string, string> = {
  E002: 'La cifra di controllo non è corretta: il numero è stato letto o digitato male.',
  E030: 'Numero riservato a uso interno (circolazione ristretta): non identifica un prodotto nel mercato aperto.',
  E037: 'Numero riservato ai coupon: non identifica un prodotto.',
  E039: 'Il numero non risulta assegnato da GS1 a nessuna azienda.',
}

const linkLabels: Record<string, string> = {
  pip: 'Informazioni prodotto',
  hasRetailers: 'Dove acquistare',
  recipeInfo: 'Ricette',
  productSustainabilityInfo: 'Sostenibilità',
  whatsInTheBox: 'Contenuto della confezione',
  epil: 'Foglietto illustrativo',
  smpc: 'Riassunto caratteristiche prodotto',
  instructions: 'Istruzioni',
  allergenInfo: 'Allergeni',
  nutritionalInfo: 'Valori nutrizionali',
  promotion: 'Promozioni',
  support: 'Assistenza',
  review: 'Recensioni',
  certificationInfo: 'Certificazioni',
  safetyInfo: 'Sicurezza',
  traceability: 'Tracciabilità',
  defaultLink: 'Sito del prodotto',
  relatedVideo: 'Video',
  socialMedia: 'Social',
  recallStatus: 'Richiami',
  registerProduct: 'Registra il prodotto',
  faqs: 'Domande frequenti',
  quickStartGuide: 'Guida rapida',
  sustainabilityInfo: 'Sostenibilità',
}

const units: Record<string, string> = { GRM: 'g', KGM: 'kg', MGM: 'mg', MLT: 'ml', CLT: 'cl', LTR: 'l', H87: 'pz', MTR: 'm', CMT: 'cm', MMT: 'mm', MTK: 'm²', MTQ: 'm³' }

const regionNames = new Intl.DisplayNames(['it'], { type: 'region' })
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

/** Preferisce l'italiano, poi l'inglese, poi la prima lingua disponibile. */
function pick(values?: Lang[]) {
  if (!values?.length) return undefined
  return (values.find((v) => /^it/i.test(v.language)) ?? values.find((v) => /^en/i.test(v.language)) ?? values[0]).value
}

function langOf(value: Lang | string | undefined) {
  return typeof value === 'string' ? value : value?.value
}

function formatAddress(address?: RawLicence['address']) {
  if (!address) return undefined
  const street = langOf(address.streetAddress)
  const city = [langOf(address.postalCode as string), langOf(address.addressLocality)].filter(Boolean).join(' ')
  const region = langOf(address.addressRegion)
  const country = typeof address.countryCode === 'string' ? regionNames.of(address.countryCode) : undefined
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
      targets.find((t) => t.hreflang?.some((l) => /^it/i.test(l)) || t.context?.includes('it')) ??
      targets.find((t) => t.hreflang?.some((l) => /^en/i.test(l))) ??
      targets[0]
    links.push({ label: linkLabels[short] ?? best.title, title: best.title, href: best.href })
  }
  return links.slice(0, 8)
}

function mapRecord(record: RawRecord): Verification {
  const issue = record.validationErrors?.[0]?.errors?.[0]
  if (record.code === 5 || issue) {
    return { state: 'invalid', links: [], code: issue?.errorCode, message: (issue && errorMessages[issue.errorCode]) ?? issue?.message ?? 'Il codice non è valido.' }
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
    netContent: record.netContent?.map((n) => `${Number(n.value).toLocaleString('it-IT')} ${units[n.unitCode] ?? n.unitCode}`).join(' · '),
    category: record.gpcCategoryCode,
    countries: record.countryOfSaleCode?.map((c) => (c.alpha2 ? regionNames.of(c.alpha2) : c.numeric)).join(', '),
    updated: record.dateUpdated ? dateFmt.format(new Date(record.dateUpdated)) : undefined,
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
  if (!endpoint) return Promise.resolve({ state: 'error', links: [], message: 'Tipo di codice non verificabile.' })
  const key = endpoint === 'gtin' ? value.padStart(14, '0') : value
  const cacheKey = `${endpoint}:${key}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const request = fetch(`${BASE}/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([key]),
  })
    .then(async (res): Promise<Verification> => {
      if (res.status === 401 || res.status === 403) return { state: 'error', links: [], message: 'Il servizio di verifica ha rifiutato l’accesso. Controlla il token API.' }
      if (!res.ok) return { state: 'error', links: [], message: `Il servizio di verifica non risponde (errore ${res.status}).` }
      const [record] = (await res.json()) as RawRecord[]
      if (!record) return { state: 'error', links: [], message: 'Risposta vuota dal servizio di verifica.' }
      const verification = mapRecord(record)
      if (verification.category) Object.assign(verification, await gpcBrick(verification.category))
      return verification
    })
    .catch((): Verification => ({ state: 'error', links: [], message: navigator.onLine ? 'Impossibile raggiungere il servizio di verifica.' : 'Sei offline: la verifica richiede una connessione.' }))

  cache.set(cacheKey, request)
  // Gli errori di rete non vanno in cache, così "Riprova" ritenta davvero.
  void request.then((v) => v.state === 'error' && cache.delete(cacheKey))
  return request
}
