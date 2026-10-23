import { describe, expect, it } from 'vitest'
import { _setLangForTest } from '../i18n'
import { alreadyRead, combineMany, combineScans, fieldsByBarcode, type Scan } from '../components/scan'
import { assocOutcome } from '../analytics/events'
import { valueAssociations } from './associations'
import { interpretScan } from './interpret'
import { canCoexist, checkSyntax } from './syntax'

const cd = (body: string) => {
  let sum = 0
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  return body + ((10 - (sum % 10)) % 10)
}
const VAR = cd('9950600013435') // GTIN-14 con indicatore 9
const CASE = cd('1950600013435') // GTIN-14 con indicatore 1 (imballo a quantità fissa)
const ITEM = '09506000134352'
const rules = (values: Record<string, string>) => valueAssociations(values).map((n) => `${n.kind} ${n.ai}`)

describe('associazioni che dipendono dal valore (tabella 4-5)', () => {
  it('GTIN con indicatore 9 senza misura, quantità, rotolo o variante su ordinazione', () => {
    expect(rules({ '01': VAR })).toEqual(['missing 01'])
    expect(rules({ '02': VAR })).toEqual(['missing 02'])
    for (const extra of ['30', '3103', '3202', '3511', '3651', '8001', '242']) expect(rules({ '01': VAR, [extra]: '000100' })).toEqual([])
    // Le misure logistiche (33nn, 34nn) non bastano: non sono misure commerciali.
    expect(rules({ '01': VAR, '3301': '000100' })).toEqual(['missing 01'])
    expect(rules({ '01': ITEM })).toEqual([])
  })
  it('variante su ordinazione (242) con un GTIN senza indicatore 9', () => {
    expect(rules({ '01': ITEM, '242': '1' })).toEqual(['mismatch 242'])
    expect(rules({ '01': VAR, '242': '1' })).toEqual([])
  })
  it('dati di peso variabile con un GTIN di imballo a quantità fissa (indicatori 1–8)', () => {
    expect(rules({ '01': CASE, '3103': '001250' })).toEqual(['mismatch 3103'])
    expect(rules({ '01': CASE, '3922': '000299', '30': '5' })).toEqual(['mismatch 30', 'mismatch 3922'])
    // Misure logistiche e GTIN con indicatore 0 (servirebbero i dati anagrafici): nessun avviso.
    expect(rules({ '01': CASE, '3301': '001250' })).toEqual([])
    expect(rules({ '01': ITEM, '3103': '001250' })).toEqual([])
  })
})

describe('controllo con la GS1 Barcode Syntax Engine', () => {
  const check = async (data: string) => checkSyntax(await interpretScan(data, 'Manuale'))
  it('un AI obbligatorio mancante è un avviso, non un errore', async () => {
    _setLangForTest('it')
    const result = await check(`(01)${ITEM}(3922)000299`)
    expect(result?.ok).toBe(true)
    expect(result?.notices?.map((n) => `${n.kind} ${n.ai}`)).toEqual(['missing 3922'])
    expect(result?.notices?.[0].message).toContain('Quantità variabile (30) oppure misura (31nn)')
  })
  it('coppie vietate, dati errati e valori ripetuti diversi restano errori', async () => {
    expect((await check(`(01)${ITEM}(422)380(426)380`))?.ok).toBe(false)
    expect((await check(`(01)${ITEM}(17)251340`))?.ok).toBe(false)
    expect((await check(`(01)${ITEM}(10)A(10)B`))?.ok).toBe(false)
    const gs = String.fromCharCode(29)
    expect((await checkSyntax(await interpretScan(`]C101${ITEM}10A${gs}10B`, 'GS1-128')))?.ok).toBe(false)
  })
  it('aggiunge le regole sul valore', async () => {
    const result = await check(`(01)${VAR}`)
    expect([result?.ok, result?.notices?.map((n) => n.ai)]).toEqual([true, ['01']])
    expect((await check(`(01)${VAR}(3103)001250`))?.notices).toBeUndefined()
  })
})

describe('dati su più barcode dello stesso articolo', () => {
  const scan = async (data: string, format = 'GS1-128') => (await interpretScan(data, format)) as Scan
  it('unisce i dati e li ricontrolla insieme', async () => {
    const joined = combineScans(await scan(`(01)${VAR}(10)L1`), await scan(`(3103)001250(15)261231`))
    expect(joined).toMatchObject({ ok: true, data: `(01)${VAR}(10)L1(3103)001250(15)261231` })
    if (!joined.ok) return
    expect(joined.barcodes.map((b) => b.ais)).toEqual([['01', '10'], ['3103', '15']])
    const merged = await scan(joined.data)
    expect((await checkSyntax(merged))?.notices).toBeUndefined()
    const groups = fieldsByBarcode({ ...merged, barcodes: joined.barcodes })
    expect(groups?.map((g) => g.fields.map((f) => `${f.ai}=${f.value}`))).toEqual([[`01=${VAR}`, '10=L1'], ['3103=001250', '15=261231']])
  })
  it('riconosce un altro articolo e i valori in conflitto', async () => {
    expect(combineScans(await scan(`(01)${VAR}`), await scan(`(01)${ITEM}`))).toMatchObject({ ok: false, reason: 'other-item' })
    expect(combineScans(await scan(`(01)${VAR}(10)A`), await scan('(10)B(3103)001250'))).toMatchObject({ ok: false, reason: 'different-values', ai: '10' })
    expect(combineScans(await scan(`(01)${VAR}`), await scan('https://example.com', 'QR Code'))).toMatchObject({ ok: false, reason: 'not-gs1' })
  })
  it('unisce SSCC e GTIN di barcode diversi (collo che è anche unità commerciale)', async () => {
    const joined = combineScans(await scan('(00)095060001343520000'), await scan(`(01)${ITEM}(10)L1`))
    expect(joined).toMatchObject({ ok: true })
  })
  it('protegge le parentesi nei valori', async () => {
    const joined = combineScans(await scan(`(01)${VAR}`), await scan('(10)A\\(1'))
    expect(joined).toMatchObject({ ok: true, data: `(01)${VAR}(10)A\\(1` })
  })
})

describe('esito per le statistiche', () => {
  const base = async (data: string) => {
    const s = (await interpretScan(data, 'GS1-128')) as Scan
    return { ...s, syntax: await checkSyntax(s) } as Scan
  }
  it('distingue senza risposta, confermato, completato e domanda non necessaria', async () => {
    const incomplete = await base(`(01)${VAR}`)
    expect(assocOutcome(incomplete)).toBe('unanswered')
    expect(assocOutcome({ ...incomplete, assoc: 'declined' })).toBe('declined')
    const merged = { ...(await base(`(01)${VAR}(3103)001250`)), barcodes: [{ format: 'GS1-128', raw: 'a' }, { format: 'GS1-128', raw: 'b' }] }
    expect(assocOutcome(merged)).toBe('completed')
    expect(assocOutcome(await base(`(01)${ITEM}`))).toBeNull()
  })
})

describe('barcode letti insieme (etichetta logistica)', () => {
  const scan = async (data: string, format = 'GS1-128') => (await interpretScan(data, format)) as Scan
  it('unisce i barcode compatibili e scarta quelli di altri articoli', async () => {
    const label = [
      await scan('(00)095060001343520000'),
      await scan(`(02)${ITEM}(37)24`),
      await scan('(10)LOT7(15)271231'),
      await scan('(01)08076802085738', 'EAN-13'), // un altro prodotto nell'inquadratura: ha (01), ma non va con (02)…
    ]
    const joined = await combineMany(label, canCoexist)
    expect(joined?.barcodes.map((b) => b.ais)).toEqual([['00'], ['02', '37'], ['10', '15']])
    expect(joined?.skipped).toBe(1)
    const merged = await scan(joined!.data)
    expect([merged.primary?.ai, ...merged.fields.map((f) => f.ai)]).toEqual(['00', '02', '37', '10', '15'])
  })
  it('scarta un barcode con la stessa chiave ma valore diverso', async () => {
    const joined = await combineMany([await scan(`(01)${VAR}(10)A`), await scan('(3103)001250'), await scan(`(01)${ITEM}`, 'EAN-13')], canCoexist)
    expect([joined?.barcodes.length, joined?.skipped]).toEqual([2, 1])
  })
  it('compatibilità secondo le regole GS1', async () => {
    expect(await canCoexist(`(00)095060001343520000(02)${ITEM}(37)24`)).toBe(true)
    expect(await canCoexist(`(02)${ITEM}(37)24(01)${ITEM}`)).toBe(false) // (01) e (02) non vanno insieme
    expect(await canCoexist('(10)A(10)B')).toBe(false)
    expect(await canCoexist('(10)A(17)251340')).toBe(true) // data errata: lo dice il controllo di sintassi
  })
  it('riconosce un barcode già letto e non lo conta due volte', async () => {
    const sscc = await scan('(00)095060001343520000')
    expect(alreadyRead(sscc, await scan('(00)095060001343520000'))).toBe(true)
    expect(alreadyRead(sscc, await scan(`(02)${ITEM}(37)24`))).toBe(false)
    const joined = combineScans(sscc, await scan('(00)095060001343520000'))
    expect(joined.ok && joined.barcodes.length).toBe(1)
  })
  it('nessuna unione con un solo barcode', async () => {
    expect(await combineMany([await scan(`(01)${ITEM}`)])).toBeNull()
  })
})
