import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Camera, ChartColumn, Cloud, HardDrive, Lock, ShieldCheck, UserX } from 'lucide-react'
import { lang } from '../i18n'

/*
 * Informativa sul trattamento dei dati dell'app (artt. 13 e 14 del Regolamento UE 2016/679).
 * Descrive ciò che il codice fa realmente: se cambia un flusso di dati, va aggiornata anche questa pagina.
 * Titolare e contatti sono quelli dell'informativa di gs1it.org (aggiornata al 15/07/2026).
 * Il testo inglese è una traduzione di cortesia: fa fede quello italiano. Vanno aggiornati insieme.
 */
export const PRIVACY_UPDATED = '17 ottobre 2026'
const PRIVACY_UPDATED_EN = '17 October 2026'

const summary = [
  { icon: Camera, text: 'Le immagini della fotocamera restano sul tuo dispositivo: non vengono mai inviate.' },
  { icon: UserX, text: 'Non serve registrarsi e non ti chiediamo la posizione.' },
  { icon: ChartColumn, text: 'Per fini statistici registriamo l’esito delle scansioni, senza indirizzo IP né identificativi.' },
  { icon: Lock, text: 'Nessun cookie di profilazione o pubblicitario.' },
]

export function PrivacyContent() {
  const scope = useRef<HTMLDivElement>(null)
  const english = lang() === 'en'
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.privacy-summary li', { y: 12, opacity: 0, duration: 0.4, stagger: 0.06, delay: 0.15, ease: 'power2.out' })
      })
      return () => mm.revert()
    },
    { scope },
  )

  if (english) return <div className="legal" ref={scope}><PrivacyEnglish /></div>

  return (
    <div className="legal" ref={scope}>
      <p className="ig-lead">
        Informativa sul trattamento dei dati personali ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR), relativa all’app
        di verifica dei codici GS1. Ultimo aggiornamento: {PRIVACY_UPDATED}.
      </p>

      <ul className="privacy-summary">
        {summary.map(({ icon: Icon, text }) => (
          <li key={text}><Icon size={20} /> <span>{text}</span></li>
        ))}
      </ul>

      <section>
        <h3>1. Titolare del trattamento</h3>
        <p>
          <strong>GS1 Italy</strong>, Via P. Paleocapa 7, 20121 Milano (MI), C.F. 80140330152.
          <br />
          Responsabile della protezione dei dati (DPO): <a href="mailto:DPO@gs1it.org">DPO@gs1it.org</a>.
          <br />
          Per qualsiasi richiesta sui tuoi dati: <a href="mailto:privacy@gs1it.org">privacy@gs1it.org</a>.
        </p>
      </section>

      <section>
        <h3>2. Quali dati trattiamo e perché</h3>

        <h4><Camera size={16} /> Immagini della fotocamera e foto</h4>
        <p>
          La lettura dei barcode e dei codici 2D avviene interamente sul tuo dispositivo. Le immagini della fotocamera e le foto che scegli
          non vengono salvate né trasmesse. La fotocamera si attiva solo quando apri lo scanner e la richiesta di permesso è gestita dal
          browser.
        </p>

        <h4><ShieldCheck size={16} /> Verifica del codice</h4>
        <p>
          Per mostrarti a chi appartiene un codice, il numero letto (per esempio il GTIN) viene inviato al registro <strong>Verified by GS1</strong>{' '}
          di GS1 Italy. Se il codice contiene un link, il suo dominio viene confrontato con i siti registrati dal titolare del codice e
          l’indirizzo può essere controllato negli elenchi di siti pericolosi di <strong>Google Web Risk</strong>. Il numero letto e
          l’indirizzo del link non ti identificano.
          <br />
          <em>Base giuridica:</em> esecuzione del servizio che richiedi (art. 6.1.b GDPR).
        </p>

        <h4><ChartColumn size={16} /> Statistiche sulle scansioni</h4>
        <p>Per ogni scansione registriamo un evento con:</p>
        <ul className="legal-list">
          <li>data e ora, paese, regione e città approssimativa;</li>
          <li>tipo di dispositivo (telefono o computer) e modalità di lettura (fotocamera, foto, inserimento manuale);</li>
          <li>tipo di codice, esito dei controlli di conformità GS1 e codice letto (GTIN o altra chiave GS1);</li>
          <li>esito della verifica Verified by GS1: titolare del codice, categoria del prodotto, completezza della scheda;</li>
          <li>solo il <strong>dominio</strong> dell’eventuale link (non l’indirizzo completo) e l’esito del controllo di sicurezza.</li>
        </ul>
        <p>
          Paese, regione e città sono dedotti da Cloudflare dall’indirizzo IP della connessione, senza chiederti la posizione e senza GPS:
          la città è approssimativa (con le reti mobili spesso è quella del gestore). <strong>L’indirizzo IP
          non viene salvato</strong> e l’evento non contiene identificativi del dispositivo o della persona: non è possibile ricondurlo a te.
        </p>
        <p>
          <em>Finalità:</em> studi e statistiche sulla diffusione e sulla qualità dei codici GS1 (per esempio l’adozione dei codici 2D per
          categoria e regione), sul completamento dei dati in Verified by GS1 e per individuare usi abusivi dei codici a tutela dei marchi.
          I dati sono diffusi solo in forma aggregata.
          <br />
          <em>Base giuridica:</em> legittimo interesse di GS1 Italy a promuovere e verificare la corretta adozione degli standard GS1
          (art. 6.1.f GDPR). Puoi opporti in qualsiasi momento scrivendo a privacy@gs1it.org.
          <br />
          <em>Conservazione:</em> i singoli eventi sono cancellati dopo 24 mesi; restano solo i dati aggregati.
        </p>

        <h4><Cloud size={16} /> Dati tecnici di navigazione</h4>
        <p>
          Come per ogni sito, i fornitori che ospitano l’app trattano l’indirizzo IP e i dati tecnici della connessione per consegnare le
          pagine e proteggerle da abusi. I caratteri tipografici sono caricati da <strong>Google Fonts</strong> e le immagini dei prodotti dai
          server indicati dai titolari dei codici: anche questi ricevono l’indirizzo IP del dispositivo.
        </p>

        <h4><HardDrive size={16} /> Dati salvati sul tuo dispositivo</h4>
        <p>
          L’app salva nella memoria del browser le tue scansioni recenti, la fotocamera preferita e la lingua scelta, solo per offrirti queste funzioni: non
          vengono inviate e non servono a tracciarti. Puoi cancellarle con il pulsante “Svuota” nella sezione Recenti o dalle impostazioni
          del browser. Non usiamo cookie di profilazione o pubblicitari.
        </p>
      </section>

      <section>
        <h3>3. Fornitori e trasferimenti</h3>
        <p>I dati sono trattati, per conto di GS1 Italy o come titolari autonomi per i propri servizi, da:</p>
        <ul className="legal-list">
          <li><strong>Cloudflare, Inc.</strong>: pubblicazione dell’app, collegamento ai servizi di verifica, deduzione della posizione approssimativa;</li>
          <li><strong>Supabase, Inc.</strong>: archivio delle statistiche, su server nell’Unione europea (Francoforte);</li>
          <li><strong>GitHub, Inc.</strong>: pubblicazione dell’app;</li>
          <li><strong>Google LLC</strong>: caratteri tipografici (Google Fonts) e controllo dei siti pericolosi (Google Web Risk).</li>
        </ul>
        <p>
          Alcuni fornitori hanno sede negli Stati Uniti. Gli eventuali trasferimenti avvengono sulla base dell’EU-US Data Privacy Framework o
          delle clausole contrattuali standard approvate dalla Commissione europea.
        </p>
      </section>

      <section>
        <h3>4. I tuoi diritti</h3>
        <p>
          Puoi chiedere l’accesso, la rettifica, la cancellazione o la limitazione dei tuoi dati e opporti al trattamento (artt. 15-22 GDPR)
          scrivendo a <a href="mailto:privacy@gs1it.org">privacy@gs1it.org</a>. Poiché le statistiche non contengono identificativi, potremmo
          non essere in grado di individuare gli eventi che ti riguardano (art. 11 GDPR). Hai inoltre il diritto di proporre reclamo al{' '}
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer">Garante per la protezione dei dati personali</a>.
        </p>
        <p>Non effettuiamo profilazione né decisioni automatizzate che producano effetti giuridici nei tuoi confronti.</p>
      </section>

      <section>
        <h3>5. Natura delle verifiche</h3>
        <p>
          Gli esiti mostrati dall’app derivano da controlli automatici eseguiti al momento della scansione e non costituiscono una
          certificazione dell’autenticità del prodotto.
        </p>
      </section>

      <p className="legal-foot">
        Per i trattamenti svolti da GS1 Italy al di fuori di questa app vale l’
        <a href="https://gs1it.org/privacy-policy/" target="_blank" rel="noreferrer">informativa privacy di gs1it.org</a>.
      </p>
    </div>
  )
}

const summaryEn = [
  { icon: Camera, text: 'Camera images stay on your device: they are never sent.' },
  { icon: UserX, text: 'No sign-up is needed and we do not ask for your location.' },
  { icon: ChartColumn, text: 'For statistical purposes we record the outcome of scans, without IP address or identifiers.' },
  { icon: Lock, text: 'No profiling or advertising cookies.' },
]

/** Translation of the Italian notice above, for convenience. The Italian text prevails. */
function PrivacyEnglish() {
  return (
    <>
      <p className="ig-lead">
        Information on the processing of personal data under Articles 13 and 14 of Regulation (EU) 2016/679 (GDPR), relating to the GS1
        code verification app. Last updated: {PRIVACY_UPDATED_EN}. This is a courtesy translation: in case of doubt, the Italian version prevails.
      </p>

      <ul className="privacy-summary">
        {summaryEn.map(({ icon: Icon, text }) => (
          <li key={text}><Icon size={20} /> <span>{text}</span></li>
        ))}
      </ul>

      <section>
        <h3>1. Data controller</h3>
        <p>
          <strong>GS1 Italy</strong>, Via P. Paleocapa 7, 20121 Milan (MI), Italy, tax code 80140330152.
          <br />
          Data Protection Officer (DPO): <a href="mailto:DPO@gs1it.org">DPO@gs1it.org</a>.
          <br />
          For any request about your data: <a href="mailto:privacy@gs1it.org">privacy@gs1it.org</a>.
        </p>
      </section>

      <section>
        <h3>2. What data we process and why</h3>

        <h4><Camera size={16} /> Camera images and photos</h4>
        <p>
          Barcodes and 2D codes are read entirely on your device. Camera images and the photos you choose are neither stored nor
          transmitted. The camera only turns on when you open the scanner, and the permission request is handled by the browser.
        </p>

        <h4><ShieldCheck size={16} /> Code verification</h4>
        <p>
          To show you who a code belongs to, the number read (for example the GTIN) is sent to GS1 Italy’s <strong>Verified by GS1</strong>{' '}
          registry. If the code contains a link, its domain is compared with the sites registered by the code owner and the address may be
          checked against <strong>Google Web Risk</strong>’s lists of dangerous sites. The number read and the link address do not identify you.
          <br />
          <em>Legal basis:</em> performance of the service you request (Art. 6(1)(b) GDPR).
        </p>

        <h4><ChartColumn size={16} /> Scan statistics</h4>
        <p>For each scan we record an event with:</p>
        <ul className="legal-list">
          <li>date and time, country, region and approximate city;</li>
          <li>device type (phone or computer) and reading mode (camera, photo, manual entry);</li>
          <li>code type, result of the GS1 compliance checks and the code read (GTIN or other GS1 key);</li>
          <li>result of the Verified by GS1 check: code owner, product category, completeness of the record;</li>
          <li>only the <strong>domain</strong> of any link (not the full address) and the result of the safety check.</li>
        </ul>
        <p>
          Country, region and city are inferred by Cloudflare from the IP address of the connection, without asking for your location and
          without GPS: the city is approximate (on mobile networks it is often the operator’s). <strong>The IP address is not stored</strong>{' '}
          and the event contains no identifier of the device or the person: it cannot be traced back to you.
        </p>
        <p>
          <em>Purpose:</em> studies and statistics on the spread and quality of GS1 codes (for example the adoption of 2D codes by category
          and region), on the completeness of data in Verified by GS1, and to detect misuse of codes to protect brands. The data is only
          published in aggregate form.
          <br />
          <em>Legal basis:</em> GS1 Italy’s legitimate interest in promoting and checking the correct adoption of GS1 standards
          (Art. 6(1)(f) GDPR). You can object at any time by writing to privacy@gs1it.org.
          <br />
          <em>Retention:</em> individual events are deleted after 24 months; only aggregate data remains.
        </p>

        <h4><Cloud size={16} /> Technical browsing data</h4>
        <p>
          As with any website, the providers hosting the app process the IP address and technical connection data to deliver the pages and
          protect them from abuse. Fonts are loaded from <strong>Google Fonts</strong> and product images from the servers chosen by the code
          owners: these also receive the device’s IP address.
        </p>

        <h4><HardDrive size={16} /> Data stored on your device</h4>
        <p>
          The app stores your recent scans, your preferred camera and your language in the browser’s storage, only to offer these features:
          they are not sent and are not used to track you. You can delete them with the “Clear” button in the Recent section or from the
          browser settings. We do not use profiling or advertising cookies.
        </p>
      </section>

      <section>
        <h3>3. Providers and transfers</h3>
        <p>The data is processed, on behalf of GS1 Italy or as independent controllers for their own services, by:</p>
        <ul className="legal-list">
          <li><strong>Cloudflare, Inc.</strong>: app delivery, connection to the verification services, inference of the approximate location;</li>
          <li><strong>Supabase, Inc.</strong>: statistics storage, on servers in the European Union (Frankfurt);</li>
          <li><strong>GitHub, Inc.</strong>: app publishing;</li>
          <li><strong>Google LLC</strong>: fonts (Google Fonts) and dangerous-site checks (Google Web Risk).</li>
        </ul>
        <p>
          Some providers are based in the United States. Any transfers take place on the basis of the EU-US Data Privacy Framework or the
          standard contractual clauses approved by the European Commission.
        </p>
      </section>

      <section>
        <h3>4. Your rights</h3>
        <p>
          You can request access to, rectification, erasure or restriction of your data and object to processing (Arts. 15-22 GDPR) by
          writing to <a href="mailto:privacy@gs1it.org">privacy@gs1it.org</a>. As the statistics contain no identifiers, we may not be able
          to find the events that concern you (Art. 11 GDPR). You also have the right to lodge a complaint with the Italian data protection
          authority, the{' '}
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer">Garante per la protezione dei dati personali</a>.
        </p>
        <p>We do not carry out profiling or automated decisions that produce legal effects concerning you.</p>
      </section>

      <section>
        <h3>5. Nature of the checks</h3>
        <p>
          The results shown by the app come from automatic checks carried out at the time of the scan and do not certify the authenticity
          of the product.
        </p>
      </section>

      <p className="legal-foot">
        For processing carried out by GS1 Italy outside this app, the{' '}
        <a href="https://gs1it.org/privacy-policy/" target="_blank" rel="noreferrer">gs1it.org privacy notice</a> applies.
      </p>
    </>
  )
}
