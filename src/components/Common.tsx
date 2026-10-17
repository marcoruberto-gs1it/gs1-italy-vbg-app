import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronRight, TriangleAlert, X } from 'lucide-react'
import { FormatIcon } from './Illustrations'
import { formatKind, titleOf, type Scan } from './scan'

export function Sheet({ title, action, tall, onClose, children }: { title: string; action?: ReactNode; tall?: boolean; onClose: () => void; children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useGSAP(
    () => {
      gsap.from('.sheet-layer', { opacity: 0, duration: 0.25 })
      gsap.from('.sheet', { yPercent: 100, duration: 0.5, ease: 'power4.out' })
    },
    { scope },
  )

  return (
    <div ref={scope}>
      <div className="sheet-layer" onClick={onClose}>
        <div className={`sheet ${tall ? 'is-tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <span className="grabber" aria-hidden="true" />
          <header className="sheet-head">
            <h2>{title}</h2>
            {action}
            <button className="icon-btn soft" type="button" onClick={onClose} aria-label="Chiudi">
              <X size={18} />
            </button>
          </header>
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </div>
  )
}

const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })

export function HistoryList({ items, onOpen }: { items: Scan[]; onOpen: (item: Scan) => void }) {
  const scope = useRef<HTMLUListElement>(null)
  useGSAP(
    () => {
      gsap.from('.history-row', { y: 16, opacity: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' })
    },
    { scope },
  )

  return (
    <ul className="history" ref={scope}>
      {items.map((item) => (
        <li key={item.id}>
          <button className="history-row" type="button" onClick={() => onOpen(item)}>
            <span className="tile"><FormatIcon kind={formatKind(item.format)} /></span>
            <span className="last-text">
              <strong>{titleOf(item)}</strong>
              <small>{item.format} · {timeFmt.format(item.at)}</small>
            </span>
            {item.checkDigit === false ? <TriangleAlert className="warn" size={18} /> : <ChevronRight className="chev" size={20} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ManualForm({ onSubmit }: { onSubmit: (value: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  return (
    <form className="manual" onSubmit={(e) => { e.preventDefault(); if (value.trim()) void onSubmit(value.trim()) }}>
      <p className="manual-hint">Il numero sotto il codice a barre, una stringa GS1 come (01)…(17)… oppure un link.</p>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="8001234567897" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Codice" />
      <button className="cta" type="submit" disabled={!value.trim()}>Leggi il codice</button>
    </form>
  )
}
