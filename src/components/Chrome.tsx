import { useRef } from 'react'
import { AppVersion } from './AppVersion'
import { LangSwitch } from './LangSwitch'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, History, House, ImageUp, Info, Keyboard, Layers, Lock, Menu, ScanBarcode, ShieldCheck, X } from 'lucide-react'
import logo from '../assets/gs1-italy-logo.png'
import { GS1_IT, legalLinks, serviceLinks, socialLinks } from '../lib/links'
import { t } from '../i18n'

const YEAR = new Date().getFullYear()

export type Tab = 'home' | 'history'
export type InfoTopic = 'codes' | 'how' | 'vbg'

export function Header({ raised, onMenu, onLogo }: { raised: boolean; onMenu: () => void; onLogo: () => void }) {
  return (
    <header className={`header ${raised ? 'is-raised' : ''}`}>
      <button className="logo-btn" type="button" onClick={onLogo} aria-label={t('GS1 Italy, torna alla home')}>
        <img src={logo} alt={t('GS1 Italy')} width={56} height={38} />
        <span className="app-name">
          Verified
          <br />
          by GS1
        </span>
      </button>
      <div className="header-actions">
        <LangSwitch compact />
        <button className="icon-btn" type="button" onClick={onMenu} aria-label={t('Apri il menu')}>
          <Menu size={22} />
        </button>
      </div>
    </header>
  )
}

type DrawerActions = {
  onClose: () => void
  onPrivacy: () => void
  onScan: () => void
  onManual: () => void
  onImage: () => void
  onTab: (tab: Tab) => void
  onInfo: (topic: InfoTopic) => void
}

export function Drawer({ onClose, onPrivacy, onScan, onManual, onImage, onTab, onInfo }: DrawerActions) {
  const scope = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.from('.drawer', { xPercent: 100, duration: 0.45, ease: 'power3.out' })
      gsap.from('.drawer-item', { x: 24, opacity: 0, duration: 0.4, stagger: 0.035, delay: 0.12, ease: 'power2.out' })
    },
    { scope },
  )

  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }

  return (
    <div className="drawer-layer" ref={scope} onClick={onClose}>
      <nav className="drawer" aria-label={t('Menu')} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <img src={logo} alt={t('GS1 Italy')} width={56} height={38} />
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('Chiudi il menu')}>
            <X size={20} />
          </button>
        </div>

        <p className="drawer-label">{t('App')}</p>
        <button className="drawer-item" type="button" onClick={run(() => onTab('home'))}><House size={20} /> {t('Home')}</button>
        <button className="drawer-item" type="button" onClick={run(onScan)}><ScanBarcode size={20} /> {t('Scansiona')}</button>
        <button className="drawer-item" type="button" onClick={run(onManual)}><Keyboard size={20} /> {t('Inserisci un codice')}</button>
        <button className="drawer-item" type="button" onClick={run(onImage)}><ImageUp size={20} /> {t('Leggi da una foto')}</button>
        <button className="drawer-item" type="button" onClick={run(() => onTab('history'))}><History size={20} /> {t('Scansioni recenti')}</button>

        <p className="drawer-label">{t('Informazioni')}</p>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('codes'))}><Layers size={20} /> {t('Cosa puoi leggere')}</button>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('how'))}><Info size={20} /> {t('Come funziona')}</button>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('vbg'))}><ShieldCheck size={20} /> Verified by GS1</button>

        <p className="drawer-label">{t('Lingua')}</p>
        <div className="drawer-lang"><LangSwitch /></div>
        <button className="drawer-item" type="button" onClick={run(onPrivacy)}><Lock size={20} /> {t('Privacy e dati')}</button>

        <p className="drawer-label">GS1 Italy</p>
        <a className="drawer-item ext" href={GS1_IT} target="_blank" rel="noreferrer">gs1it.org <ArrowUpRight size={16} /></a>
        {serviceLinks.map((link) => (
          <a key={link.href} className="drawer-item ext" href={link.href} target="_blank" rel="noreferrer">{link.label} <ArrowUpRight size={16} /></a>
        ))}

        <AppVersion />
      </nav>
    </div>
  )
}

export function TabBar({ tab, onTab, onScan, badge }: { tab: Tab; onTab: (tab: Tab) => void; onScan: () => void; badge: number }) {
  return (
    <nav className="tabbar" aria-label={t('Sezioni')}>
      <button className={`tab ${tab === 'home' ? 'is-active' : ''}`} type="button" onClick={() => onTab('home')} aria-current={tab === 'home' ? 'page' : undefined}>
        <House size={23} />
        <span>{t('Home')}</span>
      </button>
      <button className="tab tab-scan" type="button" onClick={onScan}>
        <span className="fab"><ScanBarcode size={28} /></span>
        <span>{t('Scansiona')}</span>
      </button>
      <button className={`tab ${tab === 'history' ? 'is-active' : ''}`} type="button" onClick={() => onTab('history')} aria-current={tab === 'history' ? 'page' : undefined}>
        <span className="tab-icon">
          <History size={23} />
          {badge > 0 && <i className="tab-badge">{badge > 9 ? '9+' : badge}</i>}
        </span>
        <span>{t('Recenti')}</span>
      </button>
    </nav>
  )
}

export function Footer({ onPrivacy }: { onPrivacy: () => void }) {
  return (
    <footer className="footer">
      <img className="footer-logo" src={logo} alt={t('GS1 Italy')} width={70} height={48} />
      <p className="footer-claim">{t('The Global Language of Business')}</p>

      <div className="footer-cols">
        <div>
          <h3>{t('Servizi')}</h3>
          <ul>
            {serviceLinks.map((link) => (
              <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{t('Note legali')}</h3>
          <ul>
            <li><button className="footer-privacy" type="button" onClick={onPrivacy}>{t('Privacy e dati dell’app')}</button></li>
            {legalLinks.map((link) => (
              <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}</a></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="socials">
        {socialLinks.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
        ))}
      </div>

      <address className="footer-address">
        GS1 Italy · Via Paleocapa 7, 20121 {t('Milano')}
        <br />
        {t('Codice fiscale')} 80140330152
      </address>
      <p className="footer-copy">© {YEAR} GS1 Italy</p>
      <a className="footer-site" href={GS1_IT} target="_blank" rel="noreferrer">
        {t('Vai al sito di GS1 Italy')} <ArrowUpRight size={17} />
      </a>
    </footer>
  )
}
