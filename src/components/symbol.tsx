import type { SymbolMatrix } from '../scanner/types'

/** Matrice compatta per la cronologia: righe di moduli in esadecimale, 1 = scuro. */
export type StoredSymbol = { w: number; h: number; hex: string }

export function packSymbol(symbol: SymbolMatrix | undefined): StoredSymbol | undefined {
  if (!symbol?.width || !symbol.height) return undefined
  let bits = ''
  for (const v of symbol.data) bits += v === 0 ? '1' : '0'
  bits = bits.padEnd(Math.ceil(bits.length / 4) * 4, '0')
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return { w: symbol.width, h: symbol.height, hex }
}

function isDark(symbol: StoredSymbol, x: number, y: number) {
  const i = y * symbol.w + x
  return (parseInt(symbol.hex[i >> 2], 16) >> (3 - (i & 3))) & 1
}

/** Ridisegna esattamente il simbolo 2D scansionato (QR Code, Data Matrix…), modulo per modulo. */
export function Symbol2D({ symbol, label }: { symbol: StoredSymbol; label: string }) {
  const quiet = 2
  let d = ''
  for (let y = 0; y < symbol.h; y++) {
    let x = 0
    while (x < symbol.w) {
      if (!isDark(symbol, x, y)) {
        x++
        continue
      }
      const start = x
      while (x < symbol.w && isDark(symbol, x, y)) x++
      d += `M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`
    }
  }
  return (
    <svg className={`symbol2d ${symbol.w / symbol.h > 1.6 ? 'is-wide' : ''}`} viewBox={`0 0 ${symbol.w + quiet * 2} ${symbol.h + quiet * 2}`} role="img" aria-label={`${label} letto, ${symbol.w}×${symbol.h} moduli`} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} />
    </svg>
  )
}
