import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Keyboard, RotateCcw, ScanBarcode } from 'lucide-react'
import type { CameraError } from '../scanner/useScanner'
import type { InfoTopic } from './Chrome'
import { Footer } from './Chrome'
import { HeroBadge, IllCodes, IllPhone, IllShield } from './Illustrations'
import { t } from '../i18n'

const offText: Partial<Record<CameraError, string>> = {
  get denied() { return t('Consenti l’accesso alla fotocamera nelle impostazioni del browser per tornare a scansionare.') },
  get insecure() { return t('La fotocamera funziona solo da un indirizzo https://. Nel frattempo puoi inserire il codice a mano.') },
  get unsupported() { return t('Questo browser non dà accesso alla fotocamera. Puoi inserire il codice a mano.') },
  get notfound() { return t('Non è stata trovata nessuna fotocamera. Puoi inserire il codice a mano.') },
}

type Props = {
  cameraIssue: CameraError | null
  onScan: () => void
  onManual: () => void
  onInfo: (topic: InfoTopic) => void
  onPrivacy: () => void
}

export function Home({ cameraIssue, onScan, onManual, onInfo, onPrivacy }: Props) {
  const scope = useRef<HTMLDivElement>(null)
  const off = cameraIssue ? offText[cameraIssue] : undefined
  const canRetry = cameraIssue === 'denied' || cameraIssue === 'notfound'

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .from('.status-card', { y: 28, opacity: 0, duration: 0.7 })
          .from('.status-copy > *', { y: 14, opacity: 0, duration: 0.5, stagger: 0.07 }, '-=0.45')
          .from('.ga-core', { scale: 0.4, opacity: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'back.out(2)' }, '-=0.5')
          .from('.reveal', { y: 30, opacity: 0, duration: 0.6, stagger: 0.09 }, '-=0.35')

        gsap.to('.ga-ring', {
          attr: { r: 68 },
          strokeOpacity: 0,
          duration: 2.7,
          ease: 'sine.out',
          stagger: { each: 0.9, repeat: -1 },
        })
        gsap.fromTo('.ga-hero-beam', { y: -11 }, { y: 11, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        gsap.to('.ga-float-a', { y: -5, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        gsap.to('.ga-float-b', { y: 6, x: -2, duration: 2.9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.4 })
        gsap.to('.ga-float-c', { y: -7, rotation: -6, transformOrigin: '50% 50%', duration: 3.3, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        gsap.fromTo('.ga-beam', { y: 0 }, { y: 24, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        gsap.to('.ga-spark', { scale: 0.4, opacity: 0.3, transformOrigin: '50% 50%', duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.35 })
      })
      return () => mm.revert()
    },
    { scope, dependencies: [Boolean(off)], revertOnUpdate: true },
  )

  return (
    <div className="home" ref={scope}>
      <section className={`status-card ${off ? 'is-off' : ''}`} aria-live="polite">
        <div className="status-copy">
          <h1>
            {off ? t('Fotocamera') : t('Scanner')}
            <br />
            <em>{off ? t('non attiva') : t('pronto')}</em>
          </h1>
          <p>{off ?? t('Inquadra un barcode o un QR Code Standard GS1 e leggi subito i dati del prodotto.')}</p>
        </div>
        <HeroBadge state={off ? 'off' : 'ready'} />
        {off && !canRetry ? (
          <button className="cta cta-navy" type="button" onClick={onManual}><Keyboard size={20} /> {t('Inserisci un codice')}</button>
        ) : off ? (
          <button className="cta cta-red" type="button" onClick={onScan}><RotateCcw size={20} /> {t('Riattiva fotocamera')}</button>
        ) : (
          <button className="cta" type="button" onClick={onScan}><ScanBarcode size={21} /> {t('Scansiona un codice')}</button>
        )}
      </section>

      <section>
        <h2 className="section-label reveal">{t('Informazioni')}</h2>
        <div className="info-cards">
          <button className="info-card navy reveal" type="button" onClick={() => onInfo('codes')}>
            <span className="info-text"><strong>{t('Cosa puoi leggere')}</strong><small>{t('Scopri di più')}</small></span>
            <IllCodes />
          </button>
          <button className="info-card white reveal" type="button" onClick={() => onInfo('how')}>
            <span className="info-text"><strong>{t('Come funziona l’app?')}</strong><small>{t('Scopri di più')}</small></span>
            <IllPhone />
          </button>
          <button className="info-card peach reveal" type="button" onClick={() => onInfo('vbg')}>
            <span className="info-text"><strong>{t('Cos’è Verified by GS1?')}</strong><small>{t('Scopri di più')}</small></span>
            <IllShield />
          </button>
        </div>
      </section>

      <div className="reveal">
        <Footer onPrivacy={onPrivacy} />
      </div>
    </div>
  )
}
