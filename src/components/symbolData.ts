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

export function isDark(symbol: StoredSymbol, x: number, y: number) {
  const i = y * symbol.w + x
  return (parseInt(symbol.hex[i >> 2], 16) >> (3 - (i & 3))) & 1
}
