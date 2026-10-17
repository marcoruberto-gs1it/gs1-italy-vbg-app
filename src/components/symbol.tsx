import { isDark, type StoredSymbol } from './symbolData'

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
