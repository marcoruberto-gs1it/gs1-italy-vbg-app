import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, History, House, ImageUp, Info, Keyboard, Layers, Menu, ScanBarcode, ShieldCheck, X } from 'lucide-react'
import logo from '../assets/gs1-italy-logo.png'
import { GS1_IT, legalLinks, serviceLinks, socialLinks } from '../lib/links'

const YEAR = new Date().getFullYear()

export type Tab = 'home' | 'history'
export type InfoTopic = 'codes' | 'how' | 'vbg'

export function Header({ raised, onMenu, onLogo }: { raised: boolean; onMenu: () => void; onLogo: () => void }) {
  return (
    <header className={`header ${raised ? 'is-raised' : ''}`}>
      <button className="logo-btn" type="button" onClick={onLogo} aria-label="GS1 Italy, torna alla home">
        <img src={logo} alt="GS1 Italy" width={56} height={38} />
        <span className="app-name">
          Verified
          <br />
          by GS1
        </span>
      </button>
      <button className="icon-btn" type="button" onClick={onMenu} aria-label="Apri il menu">
        <Menu size={22} />
      </button>
    </header>
  )
}

type DrawerActions = {
  onClose: () => void
  onScan: () => void
  onManual: () => void
  onImage: () => void
  onTab: (tab: Tab) => void
  onInfo: (topic: InfoTopic) => void
}

export function Drawer({ onClose, onScan, onManual, onImage, onTab, onInfo }: DrawerActions) {
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
      <nav className="drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <img src={logo} alt="GS1 Italy" width={56} height={38} />
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Chiudi il menu">
            <X size={20} />
          </button>
        </div>

        <p className="drawer-label">App</p>
        <button className="drawer-item" type="button" onClick={run(() => onTab('home'))}><House size={20} /> Home</button>
        <button className="drawer-item" type="button" onClick={run(onScan)}><ScanBarcode size={20} /> Scansiona</button>
        <button className="drawer-item" type="button" onClick={run(onManual)}><Keyboard size={20} /> Inserisci un codice</button>
        <button className="drawer-item" type="button" onClick={run(onImage)}><ImageUp size={20} /> Leggi da una foto</button>
        <button className="drawer-item" type="button" onClick={run(() => onTab('history'))}><History size={20} /> Scansioni recenti</button>

        <p className="drawer-label">Informazioni</p>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('codes'))}><Layers size={20} /> Cosa puoi leggere</button>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('how'))}><Info size={20} /> Come funziona</button>
        <button className="drawer-item" type="button" onClick={run(() => onInfo('vbg'))}><ShieldCheck size={20} /> Verified by GS1</button>

        <p className="drawer-label">GS1 Italy</p>
        <a className="drawer-item ext" href={GS1_IT} target="_blank" rel="noreferrer">gs1it.org <ArrowUpRight size={16} /></a>
        {serviceLinks.map((link) => (
          <a key={link.href} className="drawer-item ext" href={link.href} target="_blank" rel="noreferrer">{link.label} <ArrowUpRight size={16} /></a>
        ))}
      </nav>
    </div>
  )
}

export function TabBar({ tab, onTab, onScan, badge }: { tab: Tab; onTab: (tab: Tab) => void; onScan: () => void; badge: number }) {
  return (
    <nav className="tabbar" aria-label="Sezioni">
      <button className={`tab ${tab === 'home' ? 'is-active' : ''}`} type="button" onClick={() => onTab('home')} aria-current={tab === 'home' ? 'page' : undefined}>
        <House size={23} />
        <span>Home</span>
      </button>
      <button className="tab tab-scan" type="button" onClick={onScan}>
        <span className="fab"><ScanBarcode size={28} /></span>
        <span>Scansiona</span>
      </button>
      <button className={`tab ${tab === 'history' ? 'is-active' : ''}`} type="button" onClick={() => onTab('history')} aria-current={tab === 'history' ? 'page' : undefined}>
        <span className="tab-icon">
          <History size={23} />
          {badge > 0 && <i className="tab-badge">{badge > 9 ? '9+' : badge}</i>}
        </span>
        <span>Recenti</span>
      </button>
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <img className="footer-logo" src={logo} alt="GS1 Italy" width={70} height={48} />
      <p className="footer-claim">The Global Language of Business</p>

      <div className="footer-cols">
        <div>
          <h3>Servizi</h3>
          <ul>
            {serviceLinks.map((link) => (
              <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Note legali</h3>
          <ul>
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
        GS1 Italy · Via Paleocapa 7, 20121 Milano
        <br />
        Codice fiscale 80140330152
      </address>
      <p className="footer-copy">© {YEAR} GS1 Italy</p>
      <a className="footer-site" href={GS1_IT} target="_blank" rel="noreferrer">
        Vai al sito di GS1 Italy <ArrowUpRight size={17} />
      </a>
    </footer>
  )
}
