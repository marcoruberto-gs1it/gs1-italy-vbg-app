/* Illustrazioni e icone dell'app, disegnate in SVG con la palette GS1.
   Le classi `ga-*` sono i bersagli delle animazioni GSAP. */

const NAVY = '#002c6c'
const ORANGE = '#f26334'
const SKY = '#dce6f5'

/** Barre decorative con spessori pseudo-casuali ma stabili. */
function barPattern(count: number, seed = 7) {
  const out: number[] = []
  let s = seed
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280
    out.push(1 + Math.floor((s / 233280) * 3))
  }
  return out
}

export function BarsGlyph({ x, y, w, h, color = NAVY, count = 14, seed }: { x: number; y: number; w: number; h: number; color?: string; count?: number; seed?: number }) {
  const widths = barPattern(count, seed)
  const total = widths.reduce((a, b) => a + b * 2, 0)
  const unit = w / total
  const starts = widths.map((_, i) => x + widths.slice(0, i).reduce((a, b) => a + b * 2, 0) * unit)
  return (
    <g fill={color}>
      {widths.map((bw, i) => <rect key={i} x={starts[i]} y={y} width={bw * unit} height={h} />)}
    </g>
  )
}

function Modules({ x, y, size, cells, color = NAVY, seed = 3 }: { x: number; y: number; size: number; cells: number; color?: string; seed?: number }) {
  const unit = size / cells
  const rects = []
  let s = seed
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      s = (s * 9301 + 49297) % 233280
      const finder = c === 0 || r === cells - 1
      const timing = (r === 0 && c % 2 === 0) || (c === cells - 1 && r % 2 === 1)
      if (finder || timing || s / 233280 > 0.55) rects.push(<rect key={`${r}-${c}`} x={x + c * unit} y={y + r * unit} width={unit} height={unit} />)
    }
  }
  return <g fill={color}>{rects}</g>
}

function QrGlyph({ x, y, size, color = NAVY }: { x: number; y: number; size: number; color?: string }) {
  const u = size / 7
  const eye = (ex: number, ey: number) => (
    <g key={`${ex}-${ey}`}>
      <rect x={ex} y={ey} width={u * 3} height={u * 3} rx={u * 0.6} fill="none" stroke={color} strokeWidth={u * 0.8} />
      <rect x={ex + u} y={ey + u} width={u} height={u} fill={color} />
    </g>
  )
  return (
    <g>
      {eye(x, y)}
      {eye(x + u * 4, y)}
      {eye(x, y + u * 4)}
      <g fill={color}>
        <rect x={x + u * 4} y={y + u * 4} width={u} height={u} />
        <rect x={x + u * 6} y={y + u * 4} width={u} height={u} />
        <rect x={x + u * 5} y={y + u * 5} width={u} height={u} />
        <rect x={x + u * 4} y={y + u * 6} width={u} height={u} />
        <rect x={x + u * 6} y={y + u * 6} width={u} height={u} />
      </g>
    </g>
  )
}

/** Badge della card di stato: gli anelli richiamano le onde del logo GS1. */
export function HeroBadge({ state }: { state: 'ready' | 'off' }) {
  const core = state === 'ready' ? NAVY : '#c8283a'
  return (
    <svg className="hero-badge" viewBox="0 0 140 140" aria-hidden="true">
      <defs>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={state === 'ready' ? '#9fbbe6' : '#f4a3ad'} stopOpacity="0.55" />
          <stop offset="100%" stopColor={state === 'ready' ? '#9fbbe6' : '#f4a3ad'} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="core" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={state === 'ready' ? '#1d4f9a' : '#e04556'} />
          <stop offset="100%" stopColor={core} />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r="70" fill="url(#halo)" />
      {[0, 1, 2].map((i) => (
        <circle key={i} className="ga-ring" cx="70" cy="70" r="34" fill="none" stroke={core} strokeOpacity="0.35" strokeWidth="1.5" />
      ))}
      <g className="ga-core">
        <circle cx="70" cy="70" r="34" fill="url(#core)" />
        {state === 'ready' ? (
          <>
            <BarsGlyph x={53} y={57} w={34} h={26} color="#fff" count={9} seed={11} />
            <rect className="ga-hero-beam" x="48" y="69" width="44" height="2.4" rx="1.2" fill={ORANGE} />
          </>
        ) : (
          <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round">
            <path d="M70 55v18" />
            <circle cx="70" cy="83" r="0.6" strokeWidth="5" />
          </g>
        )}
      </g>
    </svg>
  )
}

/** Card "Cosa puoi leggere": confezione con etichetta, QR e DataMatrix fluttuanti. */
export function IllCodes() {
  return (
    <svg className="ill" viewBox="0 0 140 120" aria-hidden="true">
      <circle cx="78" cy="64" r="52" fill="#ffffff" fillOpacity="0.07" />
      <g className="ga-float-a">
        <path d="M44 46l30-12 30 12-30 12z" fill="#ff8a5f" />
        <path d="M44 46v44l30 14V58z" fill={ORANGE} />
        <path d="M104 46v44l-30 14V58z" fill="#d6512a" />
        <path d="M52 64l18 8v22l-18-8z" fill="#fff" />
        <g transform="matrix(1 0.44 0 1 0 0)">
          <BarsGlyph x={54} y={45} w={14} h={11} color={NAVY} count={6} seed={5} />
        </g>
      </g>
      <g className="ga-float-b">
        <rect x="96" y="10" width="34" height="34" rx="7" fill="#fff" />
        <QrGlyph x={101} y={15} size={24} />
      </g>
      <g className="ga-float-c">
        <rect x="10" y="22" width="28" height="28" rx="6" fill="#fff" />
        <Modules x={15} y={27} size={18} cells={8} seed={9} />
      </g>
    </svg>
  )
}

/** Card "Come funziona": telefono che inquadra un codice. */
export function IllPhone() {
  return (
    <svg className="ill" viewBox="0 0 140 120" aria-hidden="true">
      <circle cx="74" cy="62" r="52" fill={SKY} />
      <g className="ga-float-a">
        <rect x="46" y="12" width="56" height="100" rx="12" fill={NAVY} />
        <rect x="51" y="20" width="46" height="84" rx="7" fill="#fff" />
        <rect x="64" y="15" width="20" height="3" rx="1.5" fill="#1d4f9a" />
        <path d="M57 44v-7h7M91 44v-7h-7M57 80v7h7M91 80v7h-7" fill="none" stroke={ORANGE} strokeWidth="2.4" strokeLinecap="round" />
        <BarsGlyph x={60} y={48} w={28} h={28} count={10} seed={21} />
        <rect className="ga-beam" x="55" y="50" width="38" height="2.4" rx="1.2" fill={ORANGE} />
      </g>
      <g className="ga-float-b">
        <circle cx="108" cy="30" r="13" fill={ORANGE} />
        <path d="M102 30.5l4 4 8-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Card "Verified by GS1": scudo con spunta e scintille. */
export function IllShield() {
  return (
    <svg className="ill" viewBox="0 0 140 120" aria-hidden="true">
      <circle cx="72" cy="62" r="50" fill="#ffffff" fillOpacity="0.6" />
      <g className="ga-float-a">
        <path d="M72 16l34 12v26c0 24-15 40-34 48-19-8-34-24-34-48V28z" fill={NAVY} />
        <path d="M72 24l26 9v21c0 19-11 32-26 39z" fill="#1d4f9a" />
        <path d="M58 60l10 10 20-21" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill={ORANGE}>
        <path className="ga-spark" d="M114 22l2.5 6.5L123 31l-6.5 2.5L114 40l-2.5-6.5L105 31l6.5-2.5z" />
        <path className="ga-spark" d="M26 70l1.8 4.2L32 76l-4.2 1.8L26 82l-1.8-4.2L20 76l4.2-1.8z" />
        <circle className="ga-spark" cx="112" cy="86" r="4" />
      </g>
    </svg>
  )
}

/* ───── Icone dei formati per l'infografica ───── */

export function FormatIcon({ kind }: { kind: 'ean' | 'gs1128' | 'databar' | 'datamatrix' | 'qr' | 'keyboard' }) {
  return (
    <svg className="format-icon" viewBox="0 0 48 48" aria-hidden="true">
      {kind === 'ean' && (
        <>
          <BarsGlyph x={8} y={10} w={32} h={24} count={11} seed={4} />
          <rect x="8" y="37" width="32" height="3" rx="1.5" fill={ORANGE} />
        </>
      )}
      {kind === 'gs1128' && <BarsGlyph x={4} y={16} w={40} h={16} count={18} seed={8} />}
      {kind === 'databar' && (
        <>
          <BarsGlyph x={8} y={11} w={32} h={11} count={10} seed={13} />
          <BarsGlyph x={8} y={26} w={32} h={11} count={10} seed={17} color={ORANGE} />
        </>
      )}
      {kind === 'datamatrix' && <Modules x={10} y={10} size={28} cells={10} seed={6} />}
      {kind === 'qr' && <QrGlyph x={10} y={10} size={28} />}
      {kind === 'keyboard' && (
        <g fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round">
          <rect x="6" y="13" width="36" height="22" rx="5" />
          <path d="M13 21h.1M19 21h.1M25 21h.1M31 21h.1M35 21h.1M15 28h18" stroke={ORANGE} />
        </g>
      )}
    </svg>
  )
}
