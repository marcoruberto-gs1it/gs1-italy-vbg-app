const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
const R = L.map((code) => [...code].map((bit) => (bit === '1' ? '0' : '1')).join(''))
const G = R.map((code) => [...code].reverse().join(''))

/** Restituisce i moduli EAN-13/EAN-8 come stringa di bit, con le guardie marcate. */
function encode(digits: string): { bits: string; guards: Set<number> } | null {
  const d = [...digits].map(Number)
  let left = ''
  let right = ''
  if (digits.length === 13) {
    const parity = PARITY[d[0]]
    d.slice(1, 7).forEach((n, i) => (left += parity[i] === 'L' ? L[n] : G[n]))
    d.slice(7).forEach((n) => (right += R[n]))
  } else if (digits.length === 8) {
    d.slice(0, 4).forEach((n) => (left += L[n]))
    d.slice(4).forEach((n) => (right += R[n]))
  } else {
    return null
  }
  const bits = `101${left}01010${right}101`
  const guards = new Set<number>()
  ;[0, 1, 2].forEach((i) => guards.add(i))
  for (let i = 0; i < 5; i++) guards.add(3 + left.length + i)
  for (let i = 0; i < 3; i++) guards.add(bits.length - 1 - i)
  return { bits, guards }
}

/** Ridisegna il codice EAN letto: la firma visiva della schermata di esito. */
export function Bars({ digits }: { digits: string }) {
  const encoded = /^\d+$/.test(digits) ? encode(digits) : null
  if (!encoded) return null
  const { bits, guards } = encoded
  const bars: { x: number; w: number; guard: boolean }[] = []
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    const prev = bars.at(-1)
    if (prev && prev.x + prev.w === i && prev.guard === guards.has(i)) prev.w += 1
    else bars.push({ x: i, w: 1, guard: guards.has(i) })
  }
  return (
    <svg className="bars" viewBox={`0 0 ${bits.length} 30`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} width={bar.w} y={0} height={bar.guard ? 30 : 26} />
      ))}
    </svg>
  )
}
