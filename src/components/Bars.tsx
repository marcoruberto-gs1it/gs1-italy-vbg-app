import { encodeEan } from './ean'

/** Ridisegna il codice EAN letto: la firma visiva della schermata di esito. */
export function Bars({ digits }: { digits: string }) {
  const encoded = /^\d+$/.test(digits) ? encodeEan(digits) : null
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
