/*
 * Tutti gli Application Identifier (AI) GS1, con nome in italiano e in inglese e tipo di valore.
 * Fonti: GS1 Barcode Syntax Dictionary (lo stesso usato dalla GS1 Barcode Syntax Engine per
 * scomporre e validare i dati) ed elenco ufficiale degli AI su https://ref.gs1.org/ai/.
 * I nomi inglesi seguono le descrizioni ufficiali, accorciate dove servono solo alla lettura.
 */
import { lang } from '../i18n'

/** Come si legge il valore di un AI (vedi aiFormat.ts). */
export type AiFormat =
  | { kind: 'gtin' }
  | { kind: 'date'; expiry?: boolean }
  | { kind: 'dateRange' }
  | { kind: 'dateTime'; expiry?: boolean }
  | { kind: 'dateHour' }
  | { kind: 'date8' }
  | { kind: 'date8Time' }
  | { kind: 'measure'; unit: string }
  | { kind: 'amount' }
  | { kind: 'amountCurrency' }
  | { kind: 'percent' }
  | { kind: 'decimal' }
  | { kind: 'countries' }
  | { kind: 'postalCountry' }
  | { kind: 'countryAlpha2' }
  | { kind: 'processor' }
  | { kind: 'yesNo' }
  | { kind: 'temperature'; unit: '°C' | '°F' }
  | { kind: 'geo' }
  | { kind: 'text' }
  | { kind: 'sex' }
  | { kind: 'roll' }
  | { kind: 'piece' }

type Entry = { from: string; to: string; it: string; en: string; format?: AiFormat }

/** [primo AI, ultimo AI, nome italiano, nome inglese, formato]. `{n}` nei nomi = posizione nell'intervallo. */
type Row = [string, string | null, string, string, AiFormat?]

const date: AiFormat = { kind: 'date' }
const text: AiFormat = { kind: 'text' }
const m = (unit: string): AiFormat => ({ kind: 'measure', unit })

const ROWS: Row[] = [
  // Chiavi di identificazione e dati del prodotto
  ['00', null, 'SSCC', 'SSCC'],
  ['01', null, 'GTIN', 'GTIN', { kind: 'gtin' }],
  ['02', null, 'GTIN contenuto', 'GTIN of contained trade items', { kind: 'gtin' }],
  ['03', null, 'GTIN su ordinazione (MtO)', 'Made-to-Order GTIN', { kind: 'gtin' }],
  ['10', null, 'Lotto', 'Batch or lot number'],
  ['11', null, 'Data di produzione', 'Production date', date],
  ['12', null, 'Data di scadenza del pagamento', 'Due date', date],
  ['13', null, 'Data di confezionamento', 'Packaging date', date],
  ['15', null, 'Da consumarsi preferibilmente entro', 'Best before date', { kind: 'date', expiry: true }],
  ['16', null, 'Da vendere entro', 'Sell by date', date],
  ['17', null, 'Data di scadenza', 'Expiration date', { kind: 'date', expiry: true }],
  ['20', null, 'Variante interna del prodotto', 'Internal product variant'],
  ['21', null, 'Numero di serie', 'Serial number'],
  ['22', null, 'Variante del prodotto di consumo', 'Consumer product variant'],
  ['235', null, 'Estensione serializzata del GTIN di terze parti (TPX)', 'Third-party serialised extension of GTIN (TPX)'],
  ['240', null, 'Identificazione aggiuntiva del produttore', 'Additional product identification'],
  ['241', null, 'Codice articolo del cliente', 'Customer part number'],
  ['242', null, 'Numero di variante su ordinazione', 'Made-to-Order variation number'],
  ['243', null, 'Numero del componente d’imballaggio', 'Packaging component number'],
  ['250', null, 'Numero di serie secondario', 'Secondary serial number'],
  ['251', null, 'Riferimento all’entità di origine', 'Reference to source entity'],
  ['253', null, 'GDTI', 'GDTI'],
  ['254', null, 'Estensione del GLN', 'GLN extension component'],
  ['255', null, 'GCN', 'GCN'],
  ['30', null, 'Quantità variabile', 'Variable count of items'],

  // Misure del prodotto a peso variabile (l'ultima cifra dell'AI = numero di decimali)
  ['3100', '3105', 'Peso netto', 'Net weight', m('kg')],
  ['3110', '3115', 'Lunghezza', 'Length', m('m')],
  ['3120', '3125', 'Larghezza o diametro', 'Width or diameter', m('m')],
  ['3130', '3135', 'Altezza o spessore', 'Height, depth or thickness', m('m')],
  ['3140', '3145', 'Superficie', 'Area', m('m²')],
  ['3150', '3155', 'Volume netto', 'Net volume', m('l')],
  ['3160', '3165', 'Volume netto', 'Net volume', m('m³')],
  ['3200', '3205', 'Peso netto', 'Net weight', m('lb')],
  ['3210', '3215', 'Lunghezza', 'Length', m('in')],
  ['3220', '3225', 'Lunghezza', 'Length', m('ft')],
  ['3230', '3235', 'Lunghezza', 'Length', m('yd')],
  ['3240', '3245', 'Larghezza o diametro', 'Width or diameter', m('in')],
  ['3250', '3255', 'Larghezza o diametro', 'Width or diameter', m('ft')],
  ['3260', '3265', 'Larghezza o diametro', 'Width or diameter', m('yd')],
  ['3270', '3275', 'Altezza o spessore', 'Height, depth or thickness', m('in')],
  ['3280', '3285', 'Altezza o spessore', 'Height, depth or thickness', m('ft')],
  ['3290', '3295', 'Altezza o spessore', 'Height, depth or thickness', m('yd')],
  // Misure dell'unità logistica
  ['3300', '3305', 'Peso lordo (unità logistica)', 'Logistic weight', m('kg')],
  ['3310', '3315', 'Lunghezza (unità logistica)', 'Logistic length', m('m')],
  ['3320', '3325', 'Larghezza (unità logistica)', 'Logistic width', m('m')],
  ['3330', '3335', 'Altezza (unità logistica)', 'Logistic height', m('m')],
  ['3340', '3345', 'Superficie (unità logistica)', 'Logistic area', m('m²')],
  ['3350', '3355', 'Volume (unità logistica)', 'Logistic volume', m('l')],
  ['3360', '3365', 'Volume (unità logistica)', 'Logistic volume', m('m³')],
  ['3370', '3375', 'Chilogrammi per metro quadro', 'Kilograms per square metre', m('kg/m²')],
  ['3400', '3405', 'Peso lordo (unità logistica)', 'Logistic weight', m('lb')],
  ['3410', '3415', 'Lunghezza (unità logistica)', 'Logistic length', m('in')],
  ['3420', '3425', 'Lunghezza (unità logistica)', 'Logistic length', m('ft')],
  ['3430', '3435', 'Lunghezza (unità logistica)', 'Logistic length', m('yd')],
  ['3440', '3445', 'Larghezza (unità logistica)', 'Logistic width', m('in')],
  ['3450', '3455', 'Larghezza (unità logistica)', 'Logistic width', m('ft')],
  ['3460', '3465', 'Larghezza (unità logistica)', 'Logistic width', m('yd')],
  ['3470', '3475', 'Altezza (unità logistica)', 'Logistic height', m('in')],
  ['3480', '3485', 'Altezza (unità logistica)', 'Logistic height', m('ft')],
  ['3490', '3495', 'Altezza (unità logistica)', 'Logistic height', m('yd')],
  ['3500', '3505', 'Superficie', 'Area', m('in²')],
  ['3510', '3515', 'Superficie', 'Area', m('ft²')],
  ['3520', '3525', 'Superficie', 'Area', m('yd²')],
  ['3530', '3535', 'Superficie (unità logistica)', 'Logistic area', m('in²')],
  ['3540', '3545', 'Superficie (unità logistica)', 'Logistic area', m('ft²')],
  ['3550', '3555', 'Superficie (unità logistica)', 'Logistic area', m('yd²')],
  ['3560', '3565', 'Peso netto', 'Net weight', m('oz t')],
  ['3570', '3575', 'Peso o volume netto', 'Net weight or volume', m('oz')],
  ['3600', '3605', 'Volume netto', 'Net volume', m('qt')],
  ['3610', '3615', 'Volume netto', 'Net volume', m('gal (US)')],
  ['3620', '3625', 'Volume (unità logistica)', 'Logistic volume', m('qt')],
  ['3630', '3635', 'Volume (unità logistica)', 'Logistic volume', m('gal (US)')],
  ['3640', '3645', 'Volume netto', 'Net volume', m('in³')],
  ['3650', '3655', 'Volume netto', 'Net volume', m('ft³')],
  ['3660', '3665', 'Volume netto', 'Net volume', m('yd³')],
  ['3670', '3675', 'Volume (unità logistica)', 'Logistic volume', m('in³')],
  ['3680', '3685', 'Volume (unità logistica)', 'Logistic volume', m('ft³')],
  ['3690', '3695', 'Volume (unità logistica)', 'Logistic volume', m('yd³')],
  ['37', null, 'Numero di unità contenute', 'Count of trade items'],

  // Importi, prezzi e coupon
  ['3900', '3909', 'Importo da pagare', 'Amount payable', { kind: 'amount' }],
  ['3910', '3919', 'Importo da pagare', 'Amount payable', { kind: 'amountCurrency' }],
  ['3920', '3929', 'Importo da pagare (peso variabile)', 'Amount payable (variable measure)', { kind: 'amount' }],
  ['3930', '3939', 'Importo da pagare (peso variabile)', 'Amount payable (variable measure)', { kind: 'amountCurrency' }],
  ['3940', '3943', 'Sconto percentuale del coupon', 'Coupon percentage discount', { kind: 'percent' }],
  ['3950', '3955', 'Importo per unità di misura', 'Amount payable per unit of measure', { kind: 'decimal' }],

  // Logistica e località
  ['400', null, 'Numero d’ordine del cliente', 'Customer’s purchase order number'],
  ['401', null, 'GINC', 'GINC'],
  ['402', null, 'GSIN', 'GSIN'],
  ['403', null, 'Codice di instradamento', 'Routing code'],
  ['410', null, 'GLN di consegna', 'Ship to GLN'],
  ['411', null, 'GLN di fatturazione', 'Bill to GLN'],
  ['412', null, 'GLN del fornitore', 'Purchased from GLN'],
  ['413', null, 'GLN del destinatario finale', 'Ship for GLN'],
  ['414', null, 'GLN della località', 'Location GLN'],
  ['415', null, 'GLN del fatturante', 'Invoicing party GLN'],
  ['416', null, 'GLN del luogo di produzione o servizio', 'Production or service location GLN'],
  ['417', null, 'GLN della parte', 'Party GLN'],
  ['420', null, 'CAP di consegna', 'Ship to postal code'],
  ['421', null, 'CAP di consegna con paese', 'Ship to postal code with country', { kind: 'postalCountry' }],
  ['422', null, 'Paese di origine', 'Country of origin', { kind: 'countries' }],
  ['423', null, 'Paese di prima lavorazione', 'Country of initial processing', { kind: 'countries' }],
  ['424', null, 'Paese di lavorazione', 'Country of processing', { kind: 'countries' }],
  ['425', null, 'Paese di smontaggio', 'Country of disassembly', { kind: 'countries' }],
  ['426', null, 'Paese dell’intera filiera', 'Country covering full process chain', { kind: 'countries' }],
  ['427', null, 'Suddivisione del paese di origine', 'Country subdivision of origin'],

  // Spedizione al consumatore: destinatario e reso
  ['4300', null, 'Destinatario: ragione sociale', 'Ship-to company name', text],
  ['4301', null, 'Destinatario: referente', 'Ship-to contact', text],
  ['4302', null, 'Destinatario: indirizzo (riga 1)', 'Ship-to address line 1', text],
  ['4303', null, 'Destinatario: indirizzo (riga 2)', 'Ship-to address line 2', text],
  ['4304', null, 'Destinatario: quartiere', 'Ship-to suburb', text],
  ['4305', null, 'Destinatario: località', 'Ship-to locality', text],
  ['4306', null, 'Destinatario: regione', 'Ship-to region', text],
  ['4307', null, 'Destinatario: paese', 'Ship-to country', { kind: 'countryAlpha2' }],
  ['4308', null, 'Destinatario: telefono', 'Ship-to telephone number'],
  ['4309', null, 'Destinatario: posizione geografica', 'Ship-to geolocation', { kind: 'geo' }],
  ['4310', null, 'Reso: ragione sociale', 'Return-to company name', text],
  ['4311', null, 'Reso: referente', 'Return-to contact', text],
  ['4312', null, 'Reso: indirizzo (riga 1)', 'Return-to address line 1', text],
  ['4313', null, 'Reso: indirizzo (riga 2)', 'Return-to address line 2', text],
  ['4314', null, 'Reso: quartiere', 'Return-to suburb', text],
  ['4315', null, 'Reso: località', 'Return-to locality', text],
  ['4316', null, 'Reso: regione', 'Return-to region', text],
  ['4317', null, 'Reso: paese', 'Return-to country', { kind: 'countryAlpha2' }],
  ['4318', null, 'Reso: CAP', 'Return-to postal code'],
  ['4319', null, 'Reso: telefono', 'Return-to telephone number'],
  ['4320', null, 'Descrizione del servizio', 'Service code description', text],
  ['4321', null, 'Merce pericolosa', 'Dangerous goods', { kind: 'yesNo' }],
  ['4322', null, 'Autorizzazione a lasciare il pacco', 'Authority to leave', { kind: 'yesNo' }],
  ['4323', null, 'Firma richiesta', 'Signature required', { kind: 'yesNo' }],
  ['4324', null, 'Consegna non prima del', 'Not before delivery date', { kind: 'dateTime' }],
  ['4325', null, 'Consegna non oltre il', 'Not after delivery date', { kind: 'dateTime' }],
  ['4326', null, 'Data di rilascio', 'Release date', date],
  ['4330', null, 'Temperatura massima', 'Maximum temperature', { kind: 'temperature', unit: '°F' }],
  ['4331', null, 'Temperatura massima', 'Maximum temperature', { kind: 'temperature', unit: '°C' }],
  ['4332', null, 'Temperatura minima', 'Minimum temperature', { kind: 'temperature', unit: '°F' }],
  ['4333', null, 'Temperatura minima', 'Minimum temperature', { kind: 'temperature', unit: '°C' }],

  // Dati di settore: alimentare, ittico, sanitario, ricondizionamento
  ['7001', null, 'Numero di stock NATO (NSN)', 'NATO Stock Number (NSN)'],
  ['7002', null, 'Classificazione UN/ECE di carcasse e tagli di carne', 'UN/ECE meat carcasses and cuts classification'],
  ['7003', null, 'Scadenza (data e ora)', 'Expiration date and time', { kind: 'dateTime', expiry: true }],
  ['7004', null, 'Potenza attiva', 'Active potency'],
  ['7005', null, 'Zona di cattura', 'Catch area'],
  ['7006', null, 'Data del primo congelamento', 'First freeze date', date],
  ['7007', null, 'Data di raccolta', 'Harvest date', { kind: 'dateRange' }],
  ['7008', null, 'Specie ittica', 'Species for fishery purposes'],
  ['7009', null, 'Tipo di attrezzo da pesca', 'Fishing gear type'],
  ['7010', null, 'Metodo di produzione', 'Production method'],
  ['7011', null, 'Data limite per il test', 'Test by date', { kind: 'dateTime' }],
  ['7020', null, 'Lotto di ricondizionamento', 'Refurbishment lot ID'],
  ['7021', null, 'Stato di funzionamento', 'Functional status'],
  ['7022', null, 'Stato di revisione', 'Revision status'],
  ['7023', null, 'GIAI dell’assemblaggio', 'GIAI of an assembly'],
  ['7030', '7039', 'Trasformatore {n}: paese e numero di approvazione', 'Processor {n}: country and approval number', { kind: 'processor' }],
  ['7040', null, 'GS1 UIC con estensione e indice dell’importatore', 'GS1 UIC with extension 1 and importer index'],
  ['7041', null, 'Tipo di unità di trasporto (UN/CEFACT)', 'UN/CEFACT freight unit type'],
  ['710', null, 'Codice sanitario nazionale: Germania (PZN)', 'National healthcare reimbursement number: Germany (PZN)'],
  ['711', null, 'Codice sanitario nazionale: Francia (CIP)', 'National healthcare reimbursement number: France (CIP)'],
  ['712', null, 'Codice sanitario nazionale: Spagna (CN)', 'National healthcare reimbursement number: Spain (CN)'],
  ['713', null, 'Codice sanitario nazionale: Brasile (DRN)', 'National healthcare reimbursement number: Brazil (DRN)'],
  ['714', null, 'Codice sanitario nazionale: Portogallo (AIM)', 'National healthcare reimbursement number: Portugal (AIM)'],
  ['715', null, 'Codice sanitario nazionale: Stati Uniti (NDC)', 'National healthcare reimbursement number: United States (NDC)'],
  ['716', null, 'Codice sanitario nazionale: Italia (AIC)', 'National healthcare reimbursement number: Italy (AIC)'],
  ['717', null, 'Codice sanitario nazionale: Costa Rica (registro sanitario)', 'National healthcare reimbursement number: Costa Rica (sanitary register)'],
  ['7230', '7239', 'Riferimento di certificazione {n1}', 'Certification reference {n1}'],
  ['7240', null, 'ID del protocollo', 'Protocol ID'],
  ['7241', null, 'Tipo di supporto AIDC', 'AIDC media type'],
  ['7242', null, 'Numero di controllo della versione (VCN)', 'Version Control Number (VCN)'],
  ['7250', null, 'Data di nascita', 'Date of birth', { kind: 'date8' }],
  ['7251', null, 'Data e ora di nascita', 'Date and time of birth', { kind: 'date8Time' }],
  ['7252', null, 'Sesso biologico', 'Biological sex', { kind: 'sex' }],
  ['7253', null, 'Cognome', 'Family name', text],
  ['7254', null, 'Nome', 'Given name', text],
  ['7255', null, 'Suffisso del nome', 'Name suffix'],
  ['7256', null, 'Nome completo', 'Full name', text],
  ['7257', null, 'Indirizzo della persona', 'Address of person', text],
  ['7258', null, 'Ordine di nascita (parto plurimo)', 'Baby birth sequence'],
  ['7259', null, 'Neonato di (cognome)', 'Baby of family name', text],

  // Altri dati e chiavi
  ['8001', null, 'Prodotti in rotolo', 'Roll products', { kind: 'roll' }],
  ['8002', null, 'Identificativo del telefono cellulare', 'Cellular mobile telephone identifier'],
  ['8003', null, 'GRAI', 'GRAI'],
  ['8004', null, 'GIAI', 'GIAI'],
  ['8005', null, 'Prezzo per unità di misura', 'Price per unit of measure'],
  ['8006', null, 'ITIP', 'ITIP', { kind: 'piece' }],
  ['8007', null, 'IBAN', 'IBAN'],
  ['8008', null, 'Data e ora di produzione', 'Production date and time', { kind: 'dateHour' }],
  ['8009', null, 'Indicatore di sensore a lettura ottica', 'Optically readable sensor indicator'],
  ['8010', null, 'CPID', 'CPID'],
  ['8011', null, 'Numero di serie CPID', 'CPID serial number'],
  ['8012', null, 'Versione del software', 'Software version'],
  ['8013', null, 'GMN', 'GMN'],
  ['8014', null, 'Identificativo di dispositivo altamente personalizzato (HIDRI)', 'Highly individualised device registration identifier (HIDRI)'],
  ['8017', null, 'GSRN del fornitore di servizi', 'Service provider GSRN'],
  ['8018', null, 'GSRN del destinatario di servizi', 'Service recipient GSRN'],
  ['8019', null, 'Numero di istanza del servizio (SRIN)', 'Service Relation Instance Number (SRIN)'],
  ['8020', null, 'Riferimento del bollettino di pagamento', 'Payment slip reference number'],
  ['8026', null, 'ITIP contenuto nell’unità logistica', 'ITIP of pieces contained in a logistic unit', { kind: 'piece' }],
  ['8030', null, 'Firma digitale (DigSig)', 'Digital signature (DigSig)'],
  ['8040', null, 'IMEI', 'IMEI'],
  ['8041', null, 'IMEI 2', 'IMEI 2'],
  ['8042', null, 'Numero eSIM', 'Embedded SIM number'],
  ['8043', null, 'Numero SIM fisica', 'Physical SIM number'],
  ['8110', null, 'Codice coupon (Nord America)', 'Coupon code (North America)'],
  ['8111', null, 'Punti fedeltà del coupon', 'Coupon loyalty points'],
  ['8112', null, 'Codice coupon con offerta positiva (Nord America)', 'Positive offer file coupon code (North America)'],
  ['8200', null, 'URL di confezionamento esteso', 'Extended packaging URL'],
  ['90', null, 'Informazioni concordate tra partner commerciali', 'Information mutually agreed between trading partners'],
  ['91', '99', 'Informazioni interne dell’azienda', 'Company internal information'],
]

const ENTRIES: Entry[] = ROWS.map(([from, to, it, en, format]) => ({ from, to: to ?? from, it, en, format }))

/** Voce del dizionario per un AI (stessa lunghezza e dentro l'intervallo), oppure undefined se non esiste. */
export function aiEntry(ai: string): Entry | undefined {
  return ENTRIES.find((e) => ai.length === e.from.length && ai >= e.from && ai <= e.to)
}

/** Formato del valore di un AI. */
export const aiFormat = (ai: string) => aiEntry(ai)?.format

/** Nome dell'AI nella lingua corrente; per un AI non in elenco, "AI" e il numero. */
export function aiLabel(ai: string): string {
  const entry = aiEntry(ai)
  if (!entry) return `AI ${ai}`
  const offset = Number(ai) - Number(entry.from)
  return (lang() === 'en' ? entry.en : entry.it).replace('{n}', String(offset)).replace('{n1}', String(offset + 1))
}

/**
 * Chiavi primarie GS1 (come nel GS1 Digital Link) e AI che le qualificano, nell'ordine in cui mostrarli.
 * Fonte: attributo dlpkey del GS1 Barcode Syntax Dictionary.
 */
export const PRIMARY_KEYS: Record<string, string[]> = {
  '00': [],
  '01': ['22', '10', '21', '235'],
  '253': [],
  '255': [],
  '401': [],
  '402': [],
  '414': ['254', '7040'],
  '415': ['8020'],
  '417': ['7040'],
  '8003': [],
  '8004': ['7040'],
  '8006': ['22', '10', '21'],
  '8010': ['8011'],
  '8013': [],
  '8017': ['8019'],
  '8018': ['8019'],
}

/** Cifre coperte dalla cifra di controllo GS1 (modulo 10) per ogni chiave numerica: [inizio, lunghezza]. */
const CHECK_DIGIT: Record<string, [number, number]> = {
  '00': [0, 18], '01': [0, 14], '02': [0, 14], '03': [0, 14], '253': [0, 13], '255': [0, 13], '402': [0, 17],
  '410': [0, 13], '411': [0, 13], '412': [0, 13], '413': [0, 13], '414': [0, 13], '415': [0, 13], '416': [0, 13], '417': [0, 13],
  '8003': [1, 13], '8006': [0, 14], '8017': [0, 18], '8018': [0, 18], '8026': [0, 14],
}

/** Cifra di controllo GS1 corretta? undefined se l'AI non ne ha una numerica. */
export function checkDigitOk(ai: string, value: string): boolean | undefined {
  const span = CHECK_DIGIT[ai]
  if (!span) return undefined
  const digits = value.slice(span[0], span[0] + span[1])
  if (!/^\d+$/.test(digits) || digits.length !== span[1]) return false
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1))
}
