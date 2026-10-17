import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, Check, Copy, ImageOff, Link2, LoaderCircle, Maximize2, Minus, RotateCcw, ScanBarcode, Share2, ShieldAlert, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { assessLink, registrableDomain, type LinkCheck } from '../gs1/linkSafety'
import { canVerify, type Verification } from '../gs1/vbg'
import { Bars } from './Bars'
import { groupDigits } from './digits'
import { FormatIcon } from './Illustrations'
import { codeType, formatKind, titleOf, type Scan } from './scan'

type Props = {
  scan: Scan
  origin: { x: number; y: number }
  onClose: () => void
  onRescan: () => void
  onRetry: () => void
  onNotice: (text: string) => void
}

const hostOf = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

export function Result({ scan, origin, onClose, onRescan, onRetry, onNotice }: Props) {
  const scope = useRef<HTMLElement>(null)
  const mounted = useRef(false)
  const [copied, setCopied] = useState(false)
  const primary = scan.primary
  const vbg = scan.vbg
  const verifiable = canVerify(primary?.ai)
  const vbgState = verifiable ? (vbg?.state ?? 'pending') : 'none'
  const digits = primary && (primary.ai === '01' || primary.ai === '00') ? primary.display : null
  const barDigits = primary?.ai === '01' ? primary.display.padStart(primary.display.length > 8 ? 13 : 8, '0') : ''
  const groups = digits ? groupDigits(primary?.ai === '01' ? barDigits : digits) : null
  const issuer = vbg?.licensee?.mo ?? scan.issuer
  const type = codeType(scan)
  // Si condivide il link canonico GS1 quando c'è, mai un dominio non verificato al posto suo.
  const shareUrl = scan.digitalLink ?? scan.url
  const canShare = typeof navigator.share === 'function'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Ingresso: apertura circolare dal punto del codice, poi sigillo, cifre e barre.
  useGSAP(
    () => {
      const at = `${origin.x}px ${origin.y}px`
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo(scope.current, { clipPath: `circle(0px at ${at})` }, { clipPath: `circle(150vmax at ${at})`, duration: 0.7, ease: 'power3.inOut' })
          .from('.seal', { scale: 0.2, opacity: 0, duration: 0.55, ease: 'back.out(2.2)' }, '-=0.3')
          .fromTo('.seal path', { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: 0.35 }, '-=0.2')
          .from('.code-type-icon, .code-type-text > *, .title', { y: 12, opacity: 0, duration: 0.45, stagger: 0.06 }, '-=0.35')
          .from('.digit-group span', { y: 14, opacity: 0, duration: 0.35, stagger: 0.025 }, '<')
          .from('.bars rect', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.3, stagger: 0.012 }, '<0.1')
          .from('.chips > *, .result-card', { y: 18, opacity: 0, duration: 0.45, stagger: 0.07 }, '-=0.3')
      })
      return () => mm.revert()
    },
    { scope },
  )

  // Ogni cambio di stato della verifica fa entrare i nuovi contenuti.
  useGSAP(
    () => {
      const first = !mounted.current
      mounted.current = true
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (vbgState === 'pending') {
          gsap.to('.vbg-pulse', { scale: 1.9, opacity: 0, duration: 1.5, ease: 'sine.out', stagger: { each: 0.5, repeat: -1 } })
          gsap.fromTo('.sk', { backgroundPositionX: '120%' }, { backgroundPositionX: '-20%', duration: 1.3, ease: 'none', repeat: -1 })
          return
        }
        const delay = first ? 0.75 : 0
        gsap.from('.vbg-reveal', { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', delay })
        gsap.from('.product-photo img', { scale: 0.85, opacity: 0, duration: 0.7, ease: 'power3.out', delay: delay + 0.1 })
        gsap.from('.core-row', { x: -12, opacity: 0, duration: 0.35, stagger: 0.07, ease: 'power2.out', delay: delay + 0.3 })
        gsap.from('.core-icon', { scale: 0, duration: 0.35, stagger: 0.07, ease: 'back.out(3)', delay: delay + 0.4 })
        gsap.from('.vbg-badge', { scale: 0.5, rotate: -12, duration: 0.6, ease: 'back.out(2.4)', delay: first ? 0.75 : 0 })
      })
      return () => mm.revert()
    },
    { scope, dependencies: [vbgState], revertOnUpdate: true },
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(primary?.value ?? scan.raw)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      onNotice('Copia non disponibile')
    }
  }

  const details: [string, string, string?][] = [
    ...scan.fields.map((f) => [f.label, f.display, f.ai] as [string, string, string]),
    ...(vbg?.updated ? [['Ultimo aggiornamento', vbg.updated] as [string, string]] : []),
  ]
  const notes = Object.fromEntries(scan.fields.map((f) => [f.ai, f]))

  return (
    <section className="result" ref={scope} aria-label="Esito della scansione">
      <header className="result-top">
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Chiudi e torna alla home">
          <X size={20} />
        </button>
        <div className="result-tools">
          <button className="icon-btn" type="button" onClick={() => void copy()} aria-label="Copia il codice">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          {canShare && (
            <button className="icon-btn" type="button" onClick={() => void navigator.share({ title: titleOf(scan), text: primary?.value ?? scan.raw, url: shareUrl }).catch(() => {})} aria-label="Condividi">
              <Share2 size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="result-body">
        <div className="hero">
          <div className="code-type">
            <span className="code-type-icon" aria-hidden="true"><FormatIcon kind={formatKind(scan.format)} /></span>
            <div className="code-type-text">
              <small>Tipo di codice</small>
              <strong>{type.title}</strong>
              <span className="code-type-tags">
                {type.tag !== type.title && <span className="tag tag-strong">{type.tag}</span>}
                {type.manual && <span className="tag">Inserito a mano</span>}
                {type.count > 1 && <span className="tag">{type.count} dati</span>}
                {issuer && /^GS1\b/.test(issuer) && <span className="tag">{issuer}</span>}
              </span>
            </div>
            <div className="seal" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
            </div>
          </div>

          {groups ? (
            <h1 className={`digits ${(digits?.length ?? 0) >= 18 ? 'is-xlong' : (digits?.length ?? 0) > 13 ? 'is-long' : ''}`} aria-label={digits ?? undefined}>
              {groups.map((group, g) => (
                <span key={g} className="digit-group">
                  {[...group].map((ch, i) => <span key={i}>{ch}</span>)}
                </span>
              ))}
            </h1>
          ) : (
            <h1 className={`title ${scan.kind === 'text' ? 'is-text' : ''}`}>{primary ? primary.display : titleOf(scan)}</h1>
          )}

          {barDigits && <Bars digits={barDigits} />}

          <div className="chips">
            {scan.checkDigit === true && <span className="chip ok"><ShieldCheck size={14} /> Cifra di controllo valida</span>}
            {scan.checkDigit === false && <span className="chip bad"><TriangleAlert size={14} /> Cifra di controllo errata</span>}
          </div>
        </div>

        {/* Il link del QR Code va valutato prima di tutto: è quello che l'utente sta per aprire. */}
        {scan.url && <LinkCard url={scan.url} raw={scan.raw.trim()} manual={scan.format === 'Manuale'} gs1={scan.kind === 'gs1'} vbg={scan.kind === 'gs1' ? (verifiable ? vbg : null) : null} safeUrl={scan.digitalLink} />}

        {verifiable && <VbgCard vbg={vbg} isProduct={primary?.ai === '01'} onRetry={onRetry} />}

        {details.length > 0 && (
          <div className="vbg-reveal">
            <h2 className="section-label">Dettagli</h2>
            <dl className="result-card fields">
              {details.map(([label, value, ai]) => {
                const field = ai ? notes[ai] : undefined
                return <Row key={`${label}-${ai ?? ''}`} label={label} ai={ai} value={value} note={field?.note} tone={field?.tone} />
              })}
            </dl>
          </div>
        )}

        {vbg?.licensee && (
          <div className="vbg-reveal">
            <h2 className="section-label">Titolare del codice</h2>
            <div className="result-card licensee">
              <strong>{vbg.licensee.name}</strong>
              {vbg.licensee.address && <p>{vbg.licensee.address}</p>}
              <dl>
                {vbg.licensee.gln && <><dt>GLN</dt><dd className="mono">{vbg.licensee.gln}</dd></>}
                {vbg.licensee.mo && <><dt>Licenza</dt><dd>{vbg.licensee.mo}</dd></>}
              </dl>
              {vbg.licensee.website && (
                <a href={vbg.licensee.website} target="_blank" rel="noreferrer">{hostOf(vbg.licensee.website)} <ArrowUpRight size={15} /></a>
              )}
            </div>
          </div>
        )}

        {vbg && vbg.links.length > 0 && (
          <div className="vbg-reveal">
            <h2 className="section-label">Link del produttore</h2>
            <ul className="result-card links">
              {vbg.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    <span>
                      <strong>{link.label}</strong>
                      <small>{hostOf(link.href)}</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!scan.url && scan.digitalLink && (
          <a className="result-card link-card" href={scan.digitalLink} target="_blank" rel="noreferrer">
            <span>
              <strong>GS1 Digital Link</strong>
              <small>{scan.digitalLink.replace(/^https?:\/\//, '')}</small>
            </span>
            <ArrowUpRight size={20} />
          </a>
        )}
      </div>

      <div className="result-dock">
        <button className="cta" type="button" onClick={onRescan}>
          <ScanBarcode size={20} /> Scansiona di nuovo
        </button>
      </div>
    </section>
  )
}

const verdicts: Record<Verification['state'], [string, string]> = {
  verified: ['Codice', 'verificato'],
  licensed: ['Codice', 'registrato'],
  invalid: ['Codice', 'non verificato'],
  error: ['Verifica', 'non disponibile'],
}

function VbgCard({ vbg, isProduct, onRetry }: { vbg?: Verification; isProduct: boolean; onRetry: () => void }) {
  if (!vbg) {
    return (
      <div className="result-card vbg-card is-pending" aria-live="polite" aria-busy="true">
        <div className="vbg-head">
          <span className="vbg-badge-wrap">
            <i className="vbg-pulse" />
            <i className="vbg-pulse" />
            <span className="vbg-badge"><ShieldCheck size={22} /></span>
          </span>
          <div>
            <h2>Verifica in corso</h2>
            <p>Controllo nel registro Verified by GS1…</p>
          </div>
        </div>
        <div className="vbg-product">
          <span className="sk sk-img" />
          <span className="sk-lines">
            <span className="sk sk-line short" />
            <span className="sk sk-line" />
            <span className="sk sk-line mid" />
          </span>
        </div>
      </div>
    )
  }

  const [lead, word] = vbg.state === 'verified' && isProduct ? ['Prodotto', 'verificato'] : verdicts[vbg.state]
  const sub =
    vbg.state === 'verified'
      ? 'Dati pubblicati dal titolare su Verified by GS1.'
      : vbg.state === 'licensed'
        ? vbg.name
          ? 'Registrato su Verified by GS1.'
          : isProduct
            ? 'Il numero è assegnato a un’azienda, che non ha ancora pubblicato i dati del prodotto.'
            : 'Il codice appartiene a un’azienda registrata presso GS1.'
        : vbg.message

  return (
    <div className={`result-card vbg-card is-${vbg.state}`} aria-live="polite">
      <div className="vbg-head">
        <span className="vbg-badge">{vbg.state === 'invalid' || vbg.state === 'error' ? <TriangleAlert size={22} /> : <ShieldCheck size={22} />}</span>
        <div className="vbg-reveal">
          <h2>{lead} <em>{word}</em></h2>
          <p>{sub}</p>
        </div>
      </div>

      {vbg.state === 'verified' && <ProductHero vbg={vbg} />}
      {vbg.state === 'licensed' && vbg.name && (
        <div className="vbg-product vbg-reveal">
          <span>
            <strong>{vbg.name}</strong>
          </span>
        </div>
      )}
      {(vbg.state === 'verified' || (vbg.state === 'licensed' && vbg.gtin)) && <CoreAttributes vbg={vbg} />}

      {(vbg.complete === false || (vbg.recordStatus && vbg.recordStatus !== 'OK')) && (
        <div className="chips left vbg-reveal">
          {vbg.state === 'verified' && vbg.complete === false && <span className="chip warn">Dati parziali</span>}
          {vbg.recordStatus === 'INACTIVE' && <span className="chip warn">Codice non più attivo</span>}
          {vbg.recordStatus === 'DISCONTINUED' && <span className="chip warn">Fuori produzione</span>}
        </div>
      )}

      {vbg.state === 'error' && (
        <button className="cta cta-navy vbg-reveal" type="button" onClick={onRetry}>
          <RotateCcw size={18} /> Riprova la verifica
        </button>
      )}
    </div>
  )
}

const linkVerdicts: Record<LinkCheck['level'], string> = {
  trusted: 'Link verificato',
  unknown: 'Dominio non riconosciuto',
  danger: 'Link sospetto',
  pending: 'Controllo del link…',
}

/**
 * Link contenuto nel QR Code: separato dalla verifica del prodotto, perché un codice autentico
 * può essere stampato in un QR Code che punta a un sito di phishing.
 */
function LinkCard({ url, raw, manual, gs1, vbg, safeUrl }: { url: string; raw: string; manual: boolean; gs1: boolean; vbg: Verification | undefined | null; safeUrl?: string }) {
  const [confirm, setConfirm] = useState(false)
  // Si mostra il testo esattamente come scritto nel codice; si apre la forma normalizzata dal browser.
  const shown = sameUrl(raw, url) ? raw : url
  const check = assessLink(url, vbg)
  const domain = registrableDomain(check.host)
  // Alternativa sicura: lo stesso codice aperto tramite il resolver GS1 (id.gs1.org).
  const alternative = safeUrl && safeUrl !== url ? safeUrl : undefined
  const Icon = check.level === 'trusted' ? ShieldCheck : check.level === 'pending' ? LoaderCircle : check.level === 'danger' ? ShieldAlert : TriangleAlert

  return (
    <div className={`result-card link-safety is-${check.level}`}>
      <p className="link-eyebrow"><Link2 size={14} /> {manual ? 'Link inserito a mano' : gs1 ? 'Link nel QR Code Standard GS1' : 'Link nel codice'}</p>
      <div className="link-head">
        <span className="link-badge"><Icon size={22} className={check.level === 'pending' ? 'spin' : undefined} /></span>
        <div>
          <h3>{linkVerdicts[check.level]}</h3>
          <p className="link-domain">{domain}</p>
          {check.host !== domain && <p className="link-host">{check.host}</p>}
        </div>
      </div>
      <ReadUrl url={shown} />
      <ul className="link-reasons">
        {check.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>

      {check.level === 'trusted' ? (
        <a className="cta cta-navy" href={url} target="_blank" rel="noreferrer">Apri il link <ArrowUpRight size={18} /></a>
      ) : alternative ? (
        <>
          <a className="cta cta-navy" href={alternative} target="_blank" rel="noreferrer">Apri tramite GS1 (id.gs1.org) <ArrowUpRight size={18} /></a>
          {check.level !== 'pending' && <button className="text-link danger-link" type="button" onClick={() => setConfirm(true)}>Apri comunque il link originale</button>}
        </>
      ) : (
        check.level !== 'pending' && <button className="cta cta-navy" type="button" onClick={() => setConfirm(true)}>Apri il link…</button>
      )}

      {confirm && <ConfirmOpen check={check} shown={shown} domain={domain} onClose={() => setConfirm(false)} />}
    </div>
  )
}

function sameUrl(raw: string, href: string) {
  try {
    return new URL(raw).href === href
  } catch {
    return false
  }
}

/**
 * L'indirizzo esattamente come è scritto nel codice, senza abbreviazioni, con il dominio in evidenza:
 * è l'informazione che serve all'utente per decidere se aprirlo.
 */
function ReadUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const match = url.match(/^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)(.*)$/is)
  let parsedHost: string | undefined
  try {
    parsedHost = new URL(url).hostname
  } catch {
    parsedHost = undefined
  }

  let body: React.ReactNode = url
  if (match) {
    const [, scheme, authority, rest] = match
    const at = authority.lastIndexOf('@')
    const userinfo = at >= 0 ? authority.slice(0, at + 1) : ''
    const host = at >= 0 ? authority.slice(at + 1) : authority
    body = (
      <>
        <span className={/^https:/i.test(scheme) ? 'url-scheme' : 'url-alert'}>{scheme}</span>
        {userinfo && <span className="url-alert">{userinfo}</span>}
        <mark className="url-host">{host}</mark>
        <span className="url-rest">{rest}</span>
      </>
    )
  }
  // Caratteri internazionali: il browser apre in realtà il dominio in forma "xn--".
  const rawHost = match?.[2].split('@').pop()?.split(':')[0].toLowerCase()
  const differs = parsedHost && rawHost && parsedHost !== rawHost

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* copia non disponibile */
    }
  }

  return (
    <div className="read-url">
      <div className="read-url-head">
        <span>Indirizzo letto</span>
        <button type="button" onClick={() => void copy()} aria-label="Copia l’indirizzo">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
      </div>
      <p className="read-url-text">{body}</p>
      {differs && <p className="read-url-note">Il browser aprirebbe in realtà il dominio <b>{parsedHost}</b></p>}
    </div>
  )
}

function ConfirmOpen({ check, shown, domain, onClose }: { check: LinkCheck; shown: string; domain: string; onClose: () => void }) {
  const scope = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  useGSAP(
    () => {
      gsap.from('.sheet-layer', { opacity: 0, duration: 0.2 })
      gsap.from('.sheet', { yPercent: 100, duration: 0.45, ease: 'power4.out' })
    },
    { scope },
  )

  return createPortal(
    <div ref={scope}>
      <div className="sheet-layer" onClick={onClose}>
        <div className={`sheet confirm-sheet is-${check.level}`} role="alertdialog" aria-modal="true" aria-label="Conferma apertura link" onClick={(e) => e.stopPropagation()}>
          <span className="grabber" aria-hidden="true" />
          <div className="sheet-body">
            <span className="link-badge big">{check.level === 'danger' ? <ShieldAlert size={28} /> : <TriangleAlert size={28} />}</span>
            <h2>{check.level === 'danger' ? 'Questo link sembra pericoloso' : 'Stai per aprire un sito non verificato'}</h2>
            <p className="confirm-lead">Il link porta a:</p>
            <p className="link-domain big">{domain}</p>
            <ReadUrl url={shown} />
            <ul className="link-reasons">
              {check.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <p className="confirm-tip">Non inserire password, dati personali o di pagamento se non sei sicuro del sito.</p>
            <button className="cta cta-navy" type="button" onClick={onClose}>Non aprire</button>
            <a className="text-link danger-link" href={check.url} target="_blank" rel="noreferrer noopener" onClick={onClose}>Apri {domain} <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Immagine del prodotto in evidenza; un tocco la apre a tutto schermo. */
function ProductHero({ vbg }: { vbg: Verification }) {
  const [broken, setBroken] = useState(false)
  const [zoom, setZoom] = useState(false)
  const showImage = vbg.image && !broken

  return (
    <div className="product-hero vbg-reveal">
      {showImage ? (
        <button className="product-photo" type="button" onClick={() => setZoom(true)} aria-label="Ingrandisci l’immagine del prodotto">
          <img src={vbg.image} alt={vbg.name ?? ''} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          <span className="zoom-hint" aria-hidden="true"><Maximize2 size={16} /></span>
        </button>
      ) : (
        <div className="product-photo is-empty" aria-hidden="true"><ImageOff size={34} /></div>
      )}
      {vbg.brand && <p className="product-brand">{vbg.brand}</p>}
      <h3 className="product-name">{vbg.name}</h3>
      {zoom && vbg.image && <Lightbox src={vbg.image} alt={vbg.name ?? ''} onClose={() => setZoom(false)} />}
    </div>
  )
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const scope = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useGSAP(
    () => {
      gsap.from('.lightbox', { opacity: 0, duration: 0.25 })
      gsap.from('.lightbox img', { scale: 0.7, opacity: 0, duration: 0.5, ease: 'back.out(1.6)' })
    },
    { scope },
  )

  // Portal su body: gli antenati animati da GSAP hanno un transform che confinerebbe il position: fixed.
  return createPortal(
    <div ref={scope}>
      <div className="lightbox" role="dialog" aria-modal="true" aria-label="Immagine del prodotto" onClick={onClose}>
        <img src={src} alt={alt} referrerPolicy="no-referrer" />
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Chiudi l’immagine">
          <X size={20} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** I 7 attributi essenziali di Verified by GS1, con indicazione di quelli non pubblicati. */
function CoreAttributes({ vbg }: { vbg: Verification }) {
  const gtin = vbg.gtin?.replace(/^0(?=\d{13}$)/, '')
  const rows: { label: string; value?: string; sub?: string }[] = [
    { label: 'GTIN', value: gtin },
    { label: 'Marca', value: vbg.brand },
    { label: 'Descrizione', value: vbg.name },
    { label: 'Immagine', value: vbg.image ? 'Disponibile' : undefined },
    { label: 'Categoria', value: vbg.categoryName ?? (vbg.category ? `GPC ${vbg.category}` : undefined), sub: vbg.categoryName ? `${vbg.categorySegment ? `${vbg.categorySegment} · ` : ''}GPC ${vbg.category}` : undefined },
    { label: 'Contenuto netto', value: vbg.netContent },
    { label: 'Paese di vendita', value: vbg.countries },
  ]
  const count = rows.filter((r) => r.value).length

  return (
    <div className="core vbg-reveal">
      <div className="core-head">
        <h3>I 7 dati essenziali</h3>
        <span className={`core-count ${count === 7 ? 'is-full' : ''}`}>{count}/7</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.label} className={`core-row ${row.value ? '' : 'is-missing'}`}>
            <i className="core-icon" aria-hidden="true">{row.value ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />}</i>
            <span className="core-label">{row.label}</span>
            <span className="core-value">
              {row.value ?? 'Non pubblicato'}
              {row.sub && <small>{row.sub}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ label, value, ai, note, tone }: { label: string; value: string; ai?: string; note?: string; tone?: string }) {
  return (
    <div className="field">
      <dt>
        {label}
        {ai && <span className="ai">{ai}</span>}
      </dt>
      <dd>
        <span>{value}</span>
        {note && <em className={`tone-${tone ?? 'ok'}`}>{note}</em>}
      </dd>
    </div>
  )
}
