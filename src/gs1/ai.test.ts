import { describe, expect, it } from 'vitest'
import { _setLangForTest } from '../i18n'
import { PRIMARY_KEYS, aiEntry, aiLabel, checkDigitOk } from './aiDictionary'
import { readable } from './aiFormat'
import { interpretScan } from './interpret'
import OFFICIAL from './gs1-ai-codes.json'

const countries = new Map([['380', 'IT'], ['250', 'FR'], ['276', 'DE']])
const show = (ai: string, value: string) => readable(ai, value, countries).display

describe('dizionario degli AI', () => {
  it('ha un nome, in italiano e in inglese, per ogni AI ufficiale GS1', () => {
    const missing: string[] = []
    for (const lang of ['it', 'en'] as const) {
      _setLangForTest(lang)
      for (const ai of OFFICIAL.codes) {
        const label = aiLabel(ai)
        if (!aiEntry(ai) || label.startsWith('AI ') || /[{}]/.test(label)) missing.push(`${lang} ${ai}`)
      }
    }
    expect(missing).toEqual([])
  })
  it('non contiene AI che GS1 non ha definito', () => {
    const official = new Set(OFFICIAL.codes)
    const all = Array.from({ length: 10_000 }, (_, i) => [String(i).padStart(2, '0'), String(i).padStart(3, '0'), String(i).padStart(4, '0')]).flat()
    expect([...new Set(all)].filter((ai) => aiEntry(ai) && !official.has(ai))).toEqual([])
  })
  it('usa i nomi giusti per gli AI della pesca', () => {
    _setLangForTest('it')
    expect([aiLabel('7005'), aiLabel('7009')]).toEqual(['Zona di cattura', 'Tipo di attrezzo da pesca'])
    _setLangForTest('en')
    expect([aiLabel('7005'), aiLabel('7009'), aiLabel('7032'), aiLabel('7230')]).toEqual(['Catch area', 'Fishing gear type', 'Processor 2: country and approval number', 'Certification reference 1'])
  })
  it('controlla la cifra di controllo delle chiavi', () => {
    expect(checkDigitOk('01', '09506000134352')).toBe(true)
    expect(checkDigitOk('01', '09506000134353')).toBe(false)
    expect(checkDigitOk('417', '9506000000008')).toBe(true)
    expect(checkDigitOk('8003', '095060001343520ABC')).toBe(true)
    expect(checkDigitOk('10', 'ABC')).toBeUndefined()
    expect(Object.keys(PRIMARY_KEYS).every((ai) => aiEntry(ai))).toBe(true)
  })
})

describe('valori leggibili', () => {
  it('formatta misure, importi, date, paesi e temperature', () => {
    _setLangForTest('it')
    expect(show('3103', '001250')).toBe('1,25 kg')
    expect(show('3922', '000299')).toBe('2,99')
    expect(show('3912', '978001299')).toMatch(/^12,99\s€$/)
    expect(show('3941', '0150')).toBe('15 %')
    expect(show('17', '251200')).toBe('dicembre 2025')
    expect(show('7006', '250315')).toBe('15 marzo 2025')
    expect(show('7007', '250301250310')).toBe('dal 1 marzo 2025 al 10 marzo 2025')
    expect(show('7003', '2512311830')).toBe('31 dicembre 2025, ore 18:30')
    expect(show('8008', '25123118')).toBe('31 dicembre 2025, ore 18:00')
    expect(show('7250', '19800215')).toBe('15 febbraio 1980')
    expect(show('423', '380250')).toBe('Italia, Francia')
    expect(show('421', '38020121')).toBe('20121 (Italia)')
    expect(show('4307', 'DE')).toBe('Germania')
    expect(show('4331', '002500-')).toBe('-25 °C')
    expect(show('4321', '1')).toBe('Sì')
    expect(show('4309', '13440000001924700000')).toBe('44,4° N, 12,47° E')
    expect(show('4309', '05000000001000000000')).toBe('40° S, 80° O')
    expect(show('4300', 'GS1%20Italy')).toBe('GS1 Italy')
    expect(show('8006', '095060001343520102')).toBe('9506000134352 · pezzo 1 di 2')
    expect(show('7030', '380ABC123')).toBe('Italia · ABC123')
    _setLangForTest('en')
    expect(show('3103', '001250')).toBe('1.25 kg')
    expect(show('7007', '250301')).toBe('1 March 2025')
    expect(show('4322', '0')).toBe('No')
  })
})

describe('scomposizione con la GS1 Barcode Syntax Engine', () => {
  const ais = async (raw: string, format = 'Manuale') => {
    const scan = await interpretScan(raw, format)
    return [scan.primary, ...scan.fields].filter(Boolean).map((f) => `${f!.ai}=${f!.value}`)
  }
  it('non perde gli AI che il Digital Link Toolkit non conosce', async () => {
    expect(await ais('(01)09506000134352(7011)251231(235)ABC(10)L1')).toEqual(['01=09506000134352', '10=L1', '235=ABC', '7011=251231'])
    expect(await ais('(00)095060001343520000(4300)GS1%20Italy(4331)002500-')).toEqual(['00=095060001343520000', '4300=GS1%20Italy', '4331=002500-'])
  })
  it('riconosce il GLN di una parte (417) come chiave primaria', async () => {
    const scan = await interpretScan('(417)9506000000008', 'Manuale')
    expect(scan.primary?.ai).toBe('417')
    expect(scan.checkDigit).toBe(true)
    const wrong = await interpretScan('(417)9506000000005(7040)1ABC', 'Manuale')
    expect([wrong.primary?.ai, wrong.checkDigit, wrong.fields.map((f) => f.ai)]).toEqual(['417', false, ['7040']])
  })
  it('legge dati grezzi con FNC1 e link GS1 Digital Link', async () => {
    const gs = String.fromCharCode(29)
    expect(await ais(`]d201095060001343521725123110AB12${gs}7009TRAWL`, 'GS1 DataMatrix')).toEqual(['01=09506000134352', '10=AB12', '17=251231', '7009=TRAWL'])
    expect(await ais('https://id.gs1.org/01/09506000134352/10/AB?17=251231&7005=27', 'QR Code')).toEqual(['01=09506000134352', '10=AB', '17=251231', '7005=27'])
  })
  it('mostra comunque i dati con cifra di controllo errata', async () => {
    const scan = await interpretScan('(01)09506000134353(10)L1', 'Manuale')
    expect(scan.primary?.value).toBe('09506000134353')
    expect(scan.checkDigit).toBe(false)
  })
})
