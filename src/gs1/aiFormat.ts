/*
 * Valori degli AI in forma leggibile, nella lingua corrente: date, misure, importi, paesi,
 * temperature… Il formato di ogni AI è nel dizionario (aiDictionary.ts); le regole di codifica
 * seguono le GS1 General Specifications.
 */
import { locale, t } from '../i18n'
import { aiFormat } from './aiDictionary'

export type Tone = 'ok' | 'warn' | 'bad'
export type Readable = { display: string; note?: string; tone?: Tone }

/** Codici numerici ISO 4217 delle valute più comuni (il resto si mostra col numero). */
const CURRENCIES: Record<string, string> = {
  '978': 'EUR', '840': 'USD', '826': 'GBP', '756': 'CHF', '392': 'JPY', '156': 'CNY', '124': 'CAD', '036': 'AUD',
  '752': 'SEK', '578': 'NOK', '208': 'DKK', '985': 'PLN', '203': 'CZK', '348': 'HUF', '946': 'RON', '975': 'BGN',
  '949': 'TRY', '986': 'BRL', '484': 'MXN', '356': 'INR', '410': 'KRW', '554': 'NZD', '710': 'ZAR', '702': 'SGD',
}

/** Nome del paese nella lingua corrente, dal codice ISO 3166-1 alpha-2. */
export function countryName(alpha2: string) {
  try {
    return new Intl.DisplayNames([locale()], { type: 'region' }).of(alpha2.toUpperCase()) ?? alpha2
  } catch {
    return alpha2
  }
}

/** Anno a 2 cifre secondo la regola GS1 (finestra -49/+50 anni). */
function gs1Year(yy: number) {
  const now = new Date().getFullYear()
  const century = Math.floor(now / 100) * 100
  const diff = yy - (now % 100)
  if (diff >= 51) return century - 100 + yy
  if (diff <= -50) return century + 100 + yy
  return century + yy
}

/** Data YYMMDD (DD = 00: ultimo giorno del mese) o YYYYMMDD. */
function parseDate(value: string): Date | null {
  const long = value.length === 8
  if (!/^\d+$/.test(value) || (value.length !== 6 && !long)) return null
  const year = long ? Number(value.slice(0, 4)) : gs1Year(Number(value.slice(0, 2)))
  const [month, day] = [Number(value.slice(-4, -2)), Number(value.slice(-2))]
  return day === 0 ? new Date(year, month, 0) : new Date(year, month - 1, day)
}

function dateText(value: string) {
  const date = parseDate(value)
  if (!date) return value
  const monthOnly = value.length === 6 && value.endsWith('00')
  return date.toLocaleDateString(locale(), monthOnly ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Ora hhmm[ss] → hh:mm[:ss]. */
const timeText = (hhmm: string) => hhmm.match(/\d\d/g)?.join(':') ?? hhmm

/** Avviso su scadenze e termini: scaduto, oggi, entro una settimana, valido. */
function expiryNote(ai: string, value: string): Pick<Readable, 'note' | 'tone'> {
  const date = parseDate(value)
  if (!date) return {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { note: ai === '15' ? t('Superato') : t('Scaduto'), tone: 'bad' }
  if (days === 0) return { note: t('Oggi'), tone: 'warn' }
  if (days <= 7) return { note: days === 1 ? t('Tra 1 giorno') : t('Tra {n} giorni', { n: days }), tone: 'warn' }
  return { note: t('Valido'), tone: 'ok' }
}

const number = (n: number, decimals: number, min = 0) =>
  n.toLocaleString(locale(), { minimumFractionDigits: Math.min(min, decimals), maximumFractionDigits: decimals })

/** Numero con i decimali indicati dall'ultima cifra dell'AI (es. 3103 → 3 decimali). */
const scaled = (ai: string, digits: string) => Number(digits) / 10 ** Number(ai.at(-1))

function countryList(value: string, countries: Map<string, string>) {
  return value.match(/\d{3}/g)?.map((code) => (countries.has(code) ? countryName(countries.get(code)!) : code)).join(', ') ?? value
}

function decode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Valore leggibile di un AI. countries: codice numerico ISO 3166 → alpha-2. */
export function readable(ai: string, value: string, countries: Map<string, string>): Readable {
  const format = aiFormat(ai)
  if (!format) return { display: value }
  switch (format.kind) {
    case 'gtin':
      return { display: value.length === 14 && value.startsWith('0') ? value.slice(1) : value }
    case 'date':
      return { display: dateText(value), ...(format.expiry ? expiryNote(ai, value) : {}) }
    case 'dateRange':
      return { display: value.length === 12 ? t('dal {from} al {to}', { from: dateText(value.slice(0, 6)), to: dateText(value.slice(6)) }) : dateText(value) }
    case 'dateTime': {
      const day = value.slice(0, 6)
      const display = value.length > 6 ? t('{date}, ore {time}', { date: dateText(day), time: timeText(value.slice(6)) }) : dateText(day)
      return { display, ...(format.expiry ? expiryNote(ai, day) : {}) }
    }
    case 'dateHour': {
      const time = value.slice(6) + (value.length === 8 ? '00' : '')
      return { display: t('{date}, ore {time}', { date: dateText(value.slice(0, 6)), time: timeText(time) }) }
    }
    case 'date8':
      return { display: dateText(value) }
    case 'date8Time':
      return { display: t('{date}, ore {time}', { date: dateText(value.slice(0, 8)), time: timeText(value.slice(8)) }) }
    case 'measure':
      return { display: `${number(scaled(ai, value), Number(ai.at(-1)))} ${format.unit}` }
    case 'amount':
      return { display: number(scaled(ai, value), Number(ai.at(-1)), 2) }
    case 'amountCurrency': {
      const amount = scaled(ai, value.slice(3))
      const currency = CURRENCIES[value.slice(0, 3)]
      if (!currency) return { display: t('{amount} (valuta ISO {code})', { amount: number(amount, Number(ai.at(-1)), 2), code: value.slice(0, 3) }) }
      return { display: amount.toLocaleString(locale(), { style: 'currency', currency, maximumFractionDigits: Math.max(2, Number(ai.at(-1))) }) }
    }
    case 'percent':
      return { display: `${number(scaled(ai, value), Number(ai.at(-1)))} %` }
    case 'decimal':
      return { display: number(scaled(ai, value), Number(ai.at(-1))) }
    case 'countries':
      return { display: countryList(value, countries) }
    case 'postalCountry':
      return { display: `${value.slice(3)} (${countryList(value.slice(0, 3), countries)})` }
    case 'countryAlpha2':
      return { display: countryName(value) }
    case 'processor': {
      const country = value.slice(0, 3) === '999' ? t('più paesi') : countryList(value.slice(0, 3), countries)
      return { display: `${country} · ${value.slice(3)}` }
    }
    case 'yesNo':
      return { display: value === '1' ? t('Sì') : value === '0' ? t('No') : value }
    case 'temperature': {
      const degrees = Number(value.slice(0, 6)) / 100
      return { display: `${number(value.endsWith('-') ? -degrees : degrees, 2)} ${format.unit}` }
    }
    case 'geo': {
      // Latitudine e longitudine codificate come (gradi + 90) e (gradi + 180), per 10 000 000.
      if (!/^\d{20}$/.test(value)) return { display: value }
      const lat = Number(value.slice(0, 10)) / 1e7 - 90
      const lon = Number(value.slice(10)) / 1e7 - 180
      const ns = lat >= 0 ? t('N') : t('S')
      const ew = lon >= 0 ? t('E') : t('O')
      return { display: `${number(Math.abs(lat), 6)}° ${ns}, ${number(Math.abs(lon), 6)}° ${ew}` }
    }
    case 'text':
      return { display: decode(value) }
    case 'sex':
      return { display: { '0': t('Non noto'), '1': t('Maschile'), '2': t('Femminile'), '9': t('Non applicabile') }[value] ?? value }
    case 'roll': {
      // Larghezza (mm), lunghezza (m), diametro interno (mm), senso di avvolgimento, giunte.
      if (!/^\d{14}$/.test(value)) return { display: value }
      const direction = { '0': t('avvolgimento esterno'), '1': t('avvolgimento interno'), '9': t('avvolgimento non definito') }[value[12]] ?? value[12]
      return {
        display: t('larghezza {w} mm · lunghezza {l} m · diametro interno {d} mm · {dir} · giunte: {s}', {
          w: Number(value.slice(0, 4)), l: Number(value.slice(4, 9)), d: Number(value.slice(9, 12)), dir: direction, s: value[13],
        }),
      }
    }
    case 'piece': {
      // GTIN del prodotto, numero del pezzo e totale dei pezzi.
      if (!/^\d{18}$/.test(value)) return { display: value }
      const gtin = value.slice(0, 14)
      return { display: t('{gtin} · pezzo {i} di {n}', { gtin: gtin.startsWith('0') ? gtin.slice(1) : gtin, i: Number(value.slice(14, 16)), n: Number(value.slice(16)) }) }
    }
  }
}
