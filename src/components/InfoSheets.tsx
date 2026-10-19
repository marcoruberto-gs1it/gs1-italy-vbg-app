import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, Camera, Check, Lock, ScanLine, ShieldCheck } from 'lucide-react'
import type { InfoTopic } from './Chrome'
import { BarsGlyph, FormatIcon, IllShield } from './Illustrations'
import { t } from '../i18n'

const formats = [
  { kind: 'ean', name: 'EAN-13 · UPC', get text() { return t('Il codice sulle confezioni in negozio') } },
  { kind: 'gs1128', name: 'GS1-128', get text() { return t('Etichette logistiche con lotto e scadenze') } },
  { kind: 'databar', name: 'GS1 DataBar', get text() { return t('Freschi e prodotti a peso variabile') } },
  { kind: 'datamatrix', name: 'GS1 DataMatrix', get text() { return t('Farmaci e dispositivi medici') } },
  { kind: 'qr', name: 'QR Code Standard GS1', get text() { return t('Con GS1 Digital Link porta alle informazioni del prodotto') } },
  { kind: 'keyboard', get name() { return t('A mano') }, get text() { return t('Digita il numero se il barcode è rovinato') } },
] as const

/** Segna un testo da tradurre senza tradurlo subito (la traduzione avviene nel rendering). */
const k = (s: string) => s

const dataPoints = ['GTIN', k('Lotto'), k('Scadenza'), k('Da consumarsi entro'), k('Numero di serie'), k('Peso netto'), k('Paese di origine'), 'SSCC', 'GLN']

const steps = [
  { icon: Camera, get title() { return t('Inquadra') }, get text() { return t('Punta la fotocamera sul codice. L’app lo riconosce da sola, anche inclinato; al buio accendi la torcia.') } },
  { icon: ScanLine, get title() { return t('Leggi') }, get text() { return t('Il contenuto viene interpretato con le librerie ufficiali GS1: GTIN, lotto, scadenza, Digital Link.') } },
  { icon: ShieldCheck, get title() { return t('Verifica') }, get text() { return t('Il numero viene cercato nel registro Verified by GS1: vedi a chi è assegnato e i dati pubblicati dal produttore.') } },
]

const vbgAttributes = ['GTIN', k('Marca'), k('Descrizione del prodotto'), k('Immagine del prodotto'), k('Categoria GPC'), k('Contenuto netto'), k('Paese di vendita')]

export const infoTitles: Record<InfoTopic, string> = {
  get codes() { return t('Cosa puoi leggere') },
  get how() { return t('Come funziona') },
  vbg: 'Verified by GS1',
}

export function InfoContent({ topic, onTryDemo }: { topic: InfoTopic; onTryDemo: () => void }) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 })
        tl.from('.ig-lead', { y: 12, opacity: 0, duration: 0.5 })
        if (topic === 'codes') {
          tl.from('.format-tile', { y: 22, opacity: 0, scale: 0.94, duration: 0.5, stagger: 0.06 }, '-=0.2')
            .from('.data-chip', { scale: 0.6, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'back.out(2.2)' }, '-=0.2')
        }
        if (topic === 'how') {
          tl.from('.step', { x: -16, opacity: 0, duration: 0.5, stagger: 0.32 }, '-=0.2')
            .from('.step-dot', { scale: 0, duration: 0.45, stagger: 0.32, ease: 'back.out(2.4)' }, '<')
            .from('.step-conn', { scaleY: 0, transformOrigin: '50% 0%', duration: 0.4, stagger: 0.32, ease: 'power2.inOut' }, '<0.25')
            .from('.privacy', { y: 16, opacity: 0, duration: 0.5 }, '-=0.1')
        }
        if (topic === 'vbg') {
          tl.from('.id-card', { y: 24, opacity: 0, rotateX: -12, transformPerspective: 600, duration: 0.6 }, '-=0.2')
            .from('.id-bars rect', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.3, stagger: 0.015 }, '-=0.3')
            .from('.id-row', { opacity: 0, x: -10, duration: 0.3, stagger: 0.12 }, '-=0.1')
            .from('.id-check', { scale: 0, duration: 0.3, stagger: 0.12, ease: 'back.out(3)' }, '<0.1')
            .from('.vbg-after > *', { y: 14, opacity: 0, duration: 0.45, stagger: 0.08 })
        }
      })
      return () => mm.revert()
    },
    { scope },
  )

  return (
    <div className="infographic" ref={scope}>
      {topic === 'codes' && (
        <>
          <p className="ig-lead">{t('L’app riconosce i barcode e i codici 2D dello standard GS1, come il QR Code Standard GS1. Legge anche altri codici che contengono un semplice link, controllandone il dominio.')}</p>
          <div className="format-grid">
            {formats.map((f) => (
              <div className="format-tile" key={f.name}>
                <FormatIcon kind={f.kind} />
                <strong>{f.name}</strong>
                <small>{f.text}</small>
              </div>
            ))}
          </div>
          <h3 className="ig-sub">{t('Dati che sa interpretare')}</h3>
          <div className="chip-cloud">
            {dataPoints.map((d) => <span className="data-chip" key={d}>{t(d)}</span>)}
          </div>
        </>
      )}

      {topic === 'how' && (
        <>
          <p className="ig-lead">{t('Tre passaggi, pochi secondi.')}</p>
          <ol className="steps">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li className="step" key={title}>
                {i < steps.length - 1 && <span className="step-conn" aria-hidden="true" />}
                <span className="step-dot"><Icon size={20} /></span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="privacy">
            <Lock size={20} />
            <p><strong>{t('Le immagini restano sul telefono.')}</strong> {t('Al registro GS1 viene inviato solo il numero letto, mai la foto. Per le statistiche registriamo l’esito della scansione senza IP né identificativi: trovi i dettagli in “Privacy e dati”.')}</p>
          </div>
        </>
      )}

      {topic === 'vbg' && (
        <>
          <p className="ig-lead">{t('È il registro globale in cui le aziende pubblicano i dati essenziali dei loro prodotti, legati al GTIN. Così chiunque può verificare a chi appartiene un codice.')}</p>
          <div className="id-card">
            <div className="id-head">
              <IllShield />
              <div>
                <small>{t('Scheda prodotto')}</small>
                <strong>{t('7 dati essenziali')}</strong>
              </div>
            </div>
            <svg className="id-bars" viewBox="0 0 120 22" preserveAspectRatio="none" aria-hidden="true">
              <BarsGlyph x={0} y={0} w={120} h={22} count={26} seed={31} color="currentColor" />
            </svg>
            <ul>
              {vbgAttributes.map((a) => (
                <li className="id-row" key={a}>
                  <span>{t(a)}</span>
                  <i className="id-check"><Check size={13} strokeWidth={3} /></i>
                </li>
              ))}
            </ul>
          </div>
          <div className="vbg-after">
            <button className="cta" type="button" onClick={onTryDemo}>{t('Prova con un GTIN dimostrativo')}</button>
            <a className="text-link" href="https://www.gs1.org/services/verified-by-gs1" target="_blank" rel="noreferrer">{t('Approfondisci su gs1.org')} <ArrowUpRight size={16} /></a>
          </div>
        </>
      )}
    </div>
  )
}
