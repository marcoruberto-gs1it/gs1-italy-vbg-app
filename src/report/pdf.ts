/*
 * Rapporto di verifica in PDF, generato sul dispositivo dopo ogni scansione.
 * Riporta il codice letto, la conformità agli standard GS1, i dati codificati, la verifica
 * Verified by GS1, l'esito dei controlli sul link e l'elenco dei controlli eseguiti.
 */
import { jsPDF } from 'jspdf'
import logoUrl from '../assets/gs1-italy-logo.png'
import { encodeEan } from '../components/ean'
import { codeType, gs1Compliance, titleOf, type Scan } from '../components/scan'
import { isDark } from '../components/symbolData'
import { assessLink, registrableDomain } from '../gs1/linkSafety'
import { canVerify } from '../gs1/vbg'

type RGB = [number, number, number]
const NAVY: RGB = [0, 44, 108]
const ORANGE: RGB = [242, 99, 52]
const INK: RGB = [15, 33, 71]
const MUTED: RGB = [95, 111, 138]
const OK: RGB = [18, 133, 90]
const WARN: RGB = [163, 90, 0]
const BAD: RGB = [200, 40, 58]
const LINE: RGB = [225, 231, 240]

const PAGE_W = 210
const PAGE_H = 297
const M = 16 // margine
const CONTENT_W = PAGE_W - M * 2

/** I font standard del PDF coprono solo l'alfabeto latino: il resto diventa "?". */
function clean(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF€–—…•·×]/g, '?')
}

async function logoDataUrl() {
  try {
    const blob = await (await fetch(logoUrl)).blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

class Writer {
  doc = new jsPDF({ unit: 'mm', format: 'a4' })
  y = 0

  color(rgb: RGB) {
    this.doc.setTextColor(...rgb)
  }

  ensure(height: number) {
    if (this.y + height <= PAGE_H - 22) return
    this.doc.addPage()
    this.y = M
  }

  section(title: string) {
    this.ensure(34) // il titolo non resta mai da solo in fondo alla pagina
    this.y += 6
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(12)
    this.color(NAVY)
    this.doc.text(clean(title), M, this.y)
    this.y += 2
    this.doc.setDrawColor(...ORANGE)
    this.doc.setLineWidth(0.6)
    this.doc.line(M, this.y, M + 18, this.y)
    this.y += 6
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; bold?: boolean; indent?: number; width?: number } = {}) {
    const size = opts.size ?? 10
    const indent = opts.indent ?? 0
    this.doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    this.doc.setFontSize(size)
    this.color(opts.color ?? INK)
    const lines = this.doc.splitTextToSize(clean(text), (opts.width ?? CONTENT_W) - indent) as string[]
    const lh = size * 0.45
    for (const line of lines) {
      this.ensure(lh + 1)
      this.doc.text(line, M + indent, this.y)
      this.y += lh
    }
    this.y += 1.5
  }

  /** Riga etichetta / valore, con il valore che va a capo nella colonna di destra. */
  row(label: string, value: string, opts: { mark?: 'ok' | 'missing' | 'bad'; mono?: boolean } = {}) {
    const labelW = 58
    this.doc.setFontSize(9.5)
    this.doc.setFont(opts.mono ? 'courier' : 'helvetica', 'bold')
    const lines = this.doc.splitTextToSize(clean(value), CONTENT_W - labelW - 6) as string[]
    const h = Math.max(1, lines.length) * 4.4 + 3
    this.ensure(h)
    const x0 = M + (opts.mark ? 6 : 0)
    if (opts.mark) {
      const c = opts.mark === 'ok' ? OK : opts.mark === 'bad' ? BAD : LINE
      this.doc.setFillColor(...c)
      this.doc.circle(M + 2, this.y - 1.2, 1.5, 'F')
    }
    this.doc.setFont('helvetica', 'normal')
    this.color(MUTED)
    this.doc.text(clean(label), x0, this.y)
    this.doc.setFont(opts.mono ? 'courier' : 'helvetica', 'bold')
    this.color(opts.mark === 'missing' ? MUTED : INK)
    this.doc.text(lines, M + labelW, this.y)
    this.y += h - 3
    this.doc.setDrawColor(...LINE)
    this.doc.setLineWidth(0.2)
    this.doc.line(M, this.y, M + CONTENT_W, this.y)
    this.y += 4.5
  }

  /** Riquadro colorato con titolo e testo (conformità, verdetti). */
  box(title: string, text: string, rgb: RGB) {
    this.doc.setFontSize(9.5)
    const lines = this.doc.splitTextToSize(clean(text), CONTENT_W - 10) as string[]
    const h = 9 + lines.length * 4.4
    this.ensure(h + 2)
    this.doc.setFillColor(...rgb)
    this.doc.roundedRect(M, this.y - 4, 2.2, h, 1, 1, 'F')
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(11)
    this.color(rgb)
    this.doc.text(clean(title), M + 6, this.y + 1)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9.5)
    this.color(INK)
    this.doc.text(lines, M + 6, this.y + 6.2)
    this.y += h + 2
  }
}

function drawSymbol(w: Writer, scan: Scan, x: number, y: number, size: number) {
  const doc = w.doc
  if (scan.symbol) {
    const s = scan.symbol
    const unit = Math.min(size / s.w, size / s.h)
    doc.setFillColor(...INK)
    for (let r = 0; r < s.h; r++) {
      let c = 0
      while (c < s.w) {
        if (!isDark(s, c, r)) {
          c++
          continue
        }
        const start = c
        while (c < s.w && isDark(s, c, r)) c++
        doc.rect(x + start * unit, y + r * unit, (c - start) * unit + 0.02, unit + 0.02, 'F')
      }
    }
    return s.h * unit
  }
  const digits = scan.primary?.ai === '01' ? scan.primary.display.padStart(scan.primary.display.length > 8 ? 13 : 8, '0') : ''
  const encoded = /^(EAN-13|EAN-8|UPC-A)$/.test(scan.format) && digits ? encodeEan(digits) : null
  if (!encoded) return 0
  const unit = size / encoded.bits.length
  doc.setFillColor(...INK)
  for (let i = 0; i < encoded.bits.length; i++) {
    if (encoded.bits[i] !== '1') continue
    const h = encoded.guards.has(i) ? size * 0.62 : size * 0.55
    doc.rect(x + i * unit, y, unit + 0.01, h, 'F')
  }
  return size * 0.62
}

const levelColor: Record<string, RGB> = { gs1: NAVY, error: BAD, partial: WARN, manual: NAVY, none: MUTED }

export async function buildReport(scan: Scan): Promise<{ blob: Blob; filename: string }> {
  const w = new Writer()
  const { doc } = w
  const now = new Date()
  const stamp = now.toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })
  const scannedAt = new Date(scan.at).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })

  // Intestazione
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 34, 'F')
  const logo = await logoDataUrl()
  if (logo) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(M, 7, 30, 20, 2, 2, 'F')
    doc.addImage(logo, 'PNG', M + 2.5, 8.5, 25, 17)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('Rapporto di verifica', M + 38, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(clean(`Generato il ${stamp}`), M + 38, 23)
  doc.setFillColor(...ORANGE)
  doc.rect(0, 34, PAGE_W, 1.4, 'F')
  w.y = 46

  // Codice letto
  const type = codeType(scan)
  const compliance = gs1Compliance(scan)
  w.section('Codice letto')
  const symbolSize = 38
  const top = w.y
  const symbolH = drawSymbol(w, scan, M + CONTENT_W - symbolSize, top - 4, symbolSize)
  const textW = symbolH ? CONTENT_W - symbolSize - 8 : CONTENT_W
  w.paragraph(type.title, { size: 15, bold: true, color: NAVY, width: textW })
  w.paragraph(`${type.tag}${type.manual ? ' · inserito a mano' : ''}`, { size: 10, color: MUTED, width: textW })
  if (scan.primary) w.paragraph(`${scan.primary.label}: ${scan.primary.display}`, { size: 12, bold: true, width: textW })
  else w.paragraph(scan.raw, { size: 10, width: textW })
  w.paragraph(`Letto il ${scannedAt}`, { size: 8.5, color: MUTED, width: textW })
  w.y = Math.max(w.y, top + symbolH + 2)
  w.box(compliance.title, `${compliance.detail}${compliance.markup ? `  Dato: ${compliance.markup}` : ''}`, levelColor[compliance.level] ?? MUTED)

  // Dati codificati
  if (scan.kind === 'gs1') {
    w.section('Dati codificati')
    for (const f of [...(scan.primary ? [scan.primary] : []), ...scan.fields]) {
      w.row(`${f.label} (${f.ai})`, f.note ? `${f.display} — ${f.note}` : f.display)
    }
    if (scan.checkDigit !== undefined) w.row('Cifra di controllo', scan.checkDigit ? 'Corretta' : 'Errata', { mark: scan.checkDigit ? 'ok' : 'bad' })
    if (scan.digitalLink) w.row('GS1 Digital Link', scan.digitalLink, { mono: true })
  }

  // Verified by GS1
  if (canVerify(scan.primary?.ai)) {
    const v = scan.vbg
    w.section('Verified by GS1')
    if (!v) w.paragraph('Verifica non completata al momento della generazione del rapporto.', { color: MUTED })
    else {
      const verdict = { verified: ['Prodotto verificato', OK], licensed: ['Codice registrato', NAVY], invalid: ['Codice non verificato', BAD], error: ['Verifica non disponibile', MUTED] }[v.state] as [string, RGB]
      w.box(verdict[0], v.state === 'verified' ? 'Dati pubblicati dal titolare su Verified by GS1 (registro GS1 Italy).' : v.message ?? 'Il numero è assegnato a un’azienda registrata presso GS1.', verdict[1])
      if (scan.primary?.ai === '01' && (v.state === 'verified' || v.state === 'licensed')) {
        const core: [string, string | undefined][] = [
          ['GTIN', v.gtin],
          ['Marca', v.brand],
          ['Descrizione', v.name],
          ['Immagine', v.image],
          ['Categoria', v.categoryName ? `${v.categoryName} (GPC ${v.category})` : v.category ? `GPC ${v.category}` : undefined],
          ['Contenuto netto', v.netContent],
          ['Paese di vendita', v.countries],
        ]
        w.ensure(30)
        w.paragraph(`I 7 dati essenziali: ${core.filter(([, value]) => value).length}/7`, { bold: true, color: NAVY })
        for (const [label, value] of core) w.row(label, value ?? 'Non pubblicato', { mark: value ? 'ok' : 'missing', mono: label === 'Immagine' && Boolean(value) })
      }
      if (v.licensee) {
        w.ensure(30)
        w.paragraph('Titolare del codice', { bold: true, color: NAVY })
        w.row('Azienda', v.licensee.name)
        if (v.licensee.address) w.row('Indirizzo', v.licensee.address)
        if (v.licensee.gln) w.row('GLN', v.licensee.gln, { mono: true })
        if (v.licensee.mo) w.row('Licenza', v.licensee.mo)
        if (v.licensee.website) w.row('Sito web', v.licensee.website, { mono: true })
      }
    }
  }

  // Link
  if (scan.url) {
    const check = assessLink(scan.url, scan.kind === 'gs1' ? (canVerify(scan.primary?.ai) ? scan.vbg : null) : null, scan.webRisk)
    const verdict = { trusted: ['Link verificato', OK], unknown: ['Dominio non riconosciuto', WARN], danger: ['Link sospetto', BAD], pending: ['Controllo non completato', MUTED] }[check.level] as [string, RGB]
    w.section(scan.kind === 'gs1' ? 'Link nel QR Code Standard GS1' : 'Link nel codice')
    w.row('Indirizzo letto', scan.url, { mono: true })
    w.row('Dominio', registrableDomain(check.host), { mono: true })
    w.box(verdict[0], check.reasons.join(' '), verdict[1])
  }

  // Controlli eseguiti
  w.section('Controlli eseguiti')
  const checks: [string, string, 'ok' | 'missing' | 'bad'][] = []
  checks.push(['Lettura del simbolo', `${type.title}${scan.symbol ? `, ${scan.symbol.w}×${scan.symbol.h} moduli` : ''}`, 'ok'])
  if (scan.kind === 'gs1') {
    checks.push(['Interpretazione GS1', 'GS1 Digital Link Toolkit (GS1)', 'ok'])
    checks.push(['Sintassi GS1', scan.syntax ? (scan.syntax.ok ? 'Conforme · GS1 Barcode Syntax Engine' : `Errori · ${scan.syntax.message ?? ''}`) : 'Non eseguito', scan.syntax ? (scan.syntax.ok ? 'ok' : 'bad') : 'missing'])
  }
  if (canVerify(scan.primary?.ai)) checks.push(['Registro Verified by GS1', scan.vbg ? (scan.vbg.state === 'error' ? 'Non disponibile' : 'Eseguito · API GS1 Italy') : 'Non completato', scan.vbg && scan.vbg.state !== 'error' ? 'ok' : 'missing'])
  if (scan.url) {
    checks.push(['Dominio del link', 'Confronto con i domini registrati dal titolare', 'ok'])
    checks.push(['Elenchi siti malevoli', scan.webRisk?.checked ? (scan.webRisk.threats.length ? 'Sito segnalato · Google Web Risk' : 'Nessuna segnalazione · Google Web Risk') : 'Non attivo', scan.webRisk?.checked ? (scan.webRisk.threats.length ? 'bad' : 'ok') : 'missing'])
  }
  for (const [label, value, mark] of checks) w.row(label, value, { mark })

  // Piè di pagina su tutte le pagine
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(M, PAGE_H - 16, PAGE_W - M, PAGE_H - 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    const note = doc.splitTextToSize(clean('Il rapporto riporta l’esito di controlli automatici eseguiti al momento della scansione e non costituisce una certificazione di autenticità del prodotto. GS1 Italy · Via Paleocapa 7, 20121 Milano · gs1it.org'), CONTENT_W - 18) as string[]
    doc.text(note, M, PAGE_H - 12)
    doc.text(`${p}/${pages}`, PAGE_W - M, PAGE_H - 12, { align: 'right' })
  }

  const id = (scan.primary?.value ?? titleOf(scan)).replace(/[^0-9A-Za-z.-]+/g, '-').slice(0, 40)
  const day = now.toISOString().slice(0, 10)
  return { blob: doc.output('blob'), filename: `verifica-${id}-${day}.pdf` }
}
