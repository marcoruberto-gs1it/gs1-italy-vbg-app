import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Camera, ChartColumn, Cloud, HardDrive, Lock, ShieldCheck, UserX } from 'lucide-react'

/*
 * Informativa sul trattamento dei dati dell'app (artt. 13 e 14 del Regolamento UE 2016/679).
 * Descrive ciò che il codice fa realmente: se cambia un flusso di dati, va aggiornata anche questa pagina.
 * Titolare e contatti sono quelli dell'informativa di gs1it.org (aggiornata al 15/07/2026).
 */
export const PRIVACY_UPDATED = '17 ottobre 2026'

const summary = [
  { icon: Camera, text: 'Le immagini della fotocamera restano sul tuo dispositivo: non vengono mai inviate.' },
  { icon: UserX, text: 'Non serve registrarsi e non ti chiediamo la posizione.' },
  { icon: ChartColumn, text: 'Per fini statistici registriamo l’esito delle scansioni, senza indirizzo IP né identificativi.' },
  { icon: Lock, text: 'Nessun cookie di profilazione o pubblicitario.' },
]

export function PrivacyContent() {
  const scope = useRef<HTMLDivElement>(null)
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
          <li>data e ora, paese e regione;</li>
          <li>tipo di dispositivo (telefono o computer) e modalità di lettura (fotocamera, foto, inserimento manuale);</li>
          <li>tipo di codice, esito dei controlli di conformità GS1 e codice letto (GTIN o altra chiave GS1);</li>
          <li>esito della verifica Verified by GS1: titolare del codice, categoria del prodotto, completezza della scheda;</li>
          <li>solo il <strong>dominio</strong> dell’eventuale link (non l’indirizzo completo) e l’esito del controllo di sicurezza.</li>
        </ul>
        <p>
          Paese e regione sono dedotti da Cloudflare dall’indirizzo IP della connessione, senza chiederti la posizione. <strong>L’indirizzo IP
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
          L’app salva nella memoria del browser le tue scansioni recenti e la fotocamera preferita, solo per offrirti queste funzioni: non
          vengono inviate e non servono a tracciarti. Puoi cancellarle con il pulsante “Svuota” nella sezione Recenti o dalle impostazioni
          del browser. Non usiamo cookie di profilazione o pubblicitari.
        </p>
      </section>

      <section>
        <h3>3. Fornitori e trasferimenti</h3>
        <p>I dati sono trattati, per conto di GS1 Italy o come titolari autonomi per i propri servizi, da:</p>
        <ul className="legal-list">
          <li><strong>Cloudflare, Inc.</strong>: pubblicazione dell’app, collegamento ai servizi di verifica, deduzione della regione;</li>
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
