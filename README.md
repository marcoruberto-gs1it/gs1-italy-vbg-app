# VbG Scan · GS1 Italy

Web app mobile per leggere codici a barre 1D e 2D e interpretarne i dati GS1. La home mostra lo stato dello scanner e le schede informative; lo scanner si apre a schermo intero e, quando riconosce un codice, il mirino si aggancia al simbolo e l'app passa alla scheda con i dati letti.

## Interfaccia

- `src/components/Home.tsx`: card di stato (scanner pronto o fotocamera non attiva), ultima scansione, schede informative e footer.
- `src/components/Chrome.tsx`: header con logo GS1 Italy e menu, menu laterale, barra di navigazione in basso, footer con i riferimenti.
- `src/components/InfoSheets.tsx`: infografiche "Cosa puoi leggere", "Come funziona" e "Verified by GS1".
- `src/components/Illustrations.tsx`: illustrazioni e icone SVG in palette GS1 (blu `#002C6C`, arancio `#F26334`).
- Le animazioni usano GSAP (`@gsap/react`) e rispettano l'impostazione di sistema che riduce il movimento.
- Il logo in `src/assets/gs1-italy-logo.png` è quello pubblicato su gs1it.org.

## Avvio

```sh
npm install
npm run dev
```

Il server di sviluppo usa HTTPS con un certificato self-signed ed è esposto in rete locale: apri dal telefono l'indirizzo `Network` mostrato da Vite e accetta l'avviso del certificato. I browser consentono la fotocamera solo su HTTPS o `localhost`.

### Permesso fotocamera

L'app chiede la fotocamera una sola volta per sessione (`src/scanner/camera.ts`): lo stream viene riusato a ogni apertura dello scanner, la fotocamera scelta viene ricordata e viene rilasciata solo dopo 90 secondi di inattività o quando l'app va in background. Se il browser salva il permesso, non viene più chiesto neanche nelle visite successive.

Chrome **non salva** il permesso sui siti con certificato non valido, come il certificato autofirmato del server di sviluppo aperto dal telefono. Per provare da telefono con un certificato valido:

```sh
npm run dev       # in un terminale
npm run tunnel    # in un altro: stampa un indirizzo https://….trycloudflare.com
```

Per l'esperienza a schermo intero completa, su telefono usa "Aggiungi a schermata Home": il manifest apre l'app in modalità `fullscreen`. Nel browser l'app chiede lo schermo intero al primo tocco, dove il browser lo consente (Android sì, iPhone no).

## Come funziona

- **Lettura**: [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (zxing-cpp in WebAssembly) in un Web Worker. Viene decodificata solo l'area visibile a schermo, un fotogramma alla volta. Il file `.wasm` viene servito dall'app, senza CDN.
- **Fotocamera**: posteriore preferita, con risoluzione ridotta in automatico se il dispositivo non supporta quella richiesta. Su Android sceglie la fotocamera principale invece del grandangolo, quando la riconosce. Usa la messa a fuoco continua e la torcia se il dispositivo le supporta. La fotocamera si ferma quando l'app va in background e riparte quando torna in primo piano.
- **Dati GS1**: la scomposizione negli AI usa la **GS1 Barcode Syntax Engine** (stesso GS1 Barcode Syntax Dictionary della validazione, quindi tutti gli AI ufficiali); se i dati non sono validi si ripiega sul [GS1 Digital Link Toolkit](https://github.com/gs1/GS1DigitalLinkToolkit.js) ufficiale (in `src/vendor/gs1`), così il contenuto si vede comunque. Logica derivata da [interpretGS1scan](https://github.com/gs1/interpretGS1scan), in `src/gs1/interpret.ts`. Legge GTIN, element string con parentesi o FNC1 e URI GS1 Digital Link, anche compressi. Controlla la cifra di controllo, ricava l'organizzazione GS1 che ha assegnato il prefisso e costruisce il Digital Link su `id.gs1.org`.
- **Nomi e valori degli AI**: `src/gs1/aiDictionary.ts` ha tutti gli AI ufficiali (nome italiano e inglese, tipo di valore); `src/gs1/aiFormat.ts` rende leggibili date, misure, importi, paesi, temperature e gli altri formati. Il test `src/gs1/ai.test.ts` confronta il dizionario con l'elenco ufficiale salvato in `src/gs1/gs1-ai-codes.json` (da [ref.gs1.org/ai](https://ref.gs1.org/ai/)): quando GS1 pubblica nuovi AI basta aggiornare quel file e il test indica quali nomi aggiungere.
- **Associazioni obbligatorie tra AI** (GS1 General Specifications, Release 26.0, §4.13.2, tabella 4-5): quelle che dipendono solo dal numero dell'AI le controlla la Syntax Engine; quelle che dipendono dal valore (GTIN con indicatore 9 senza misura, quantità, rotolo o variante su ordinazione; (242) senza GTIN con indicatore 9; dati di peso variabile con GTIN di imballo, indicatori 1–8) sono in `src/gs1/associations.ts`. Un AI obbligatorio mancante è un **avviso**, non un errore: per GS1 può stare in un altro barcode dello stesso articolo. Dal risultato si può leggere l'altro barcode ("Leggi l'altro barcode"): i dati si uniscono in un'unica scansione (`combineScans`), che viene ricontrollata per intero; un barcode con chiave primaria diversa o con lo stesso AI a valore diverso si apre invece come nuova scansione.
- **Categorie GPC**: `src/vendor/gs1/gpc-bricks-it.json` contiene i nomi italiani dei brick GPC (pubblicazione GS1 di maggio 2026, traduzione di GS1 Italy), caricati solo alla prima verifica.
- **Verified by GS1**: `src/gs1/vbg.ts` interroga l'API di GS1 Italy (`https://api.vbg.gs1it.org/v2`, endpoint `gtin`, `gln`, `sscc`, `grai`, …) e mostra se il codice è verificato, solo registrato o non valido, con prodotto, titolare e link del produttore.

## Conformità GS1 e simbolo letto

In cima all'esito una fascia dice se il codice fa parte degli standard GS1 (`gs1Compliance` in `src/components/scan.ts`):

- **Codice Standard GS1**: simbologia GS1 (EAN/UPC, ITF-14, GS1-128, GS1 DataBar, GS1 DataMatrix, QR Code Standard GS1, oppure GS1 Digital Link in un Data Matrix) con dati GS1 validi.
- **Codice GS1 con errori**: simbologia GS1 ma cifra di controllo errata.
- **Dati GS1 in un codice non standard**: dati in formato GS1 in un simbolo non codificato secondo lo standard (es. Data Matrix senza FNC1, Code 128 senza FNC1).
- **Non è un codice GS1**: link qualsiasi o testo.
- **Dati in formato GS1**: inserito a mano, nessun simbolo da verificare.

Il simbolo mostrato è quello realmente scansionato: i codici 2D sono ridisegnati modulo per modulo dalla matrice restituita dal lettore (`src/components/symbol.tsx`, salvata anche in cronologia). Le barre vengono disegnate solo per EAN-13, EAN-8 e UPC-A, la cui codifica è univoca. Per gli altri barcode 1D non si disegna nulla, piuttosto che un simbolo diverso da quello letto.

## Controllo della sintassi GS1

`src/gs1/syntax.ts` usa la libreria ufficiale **GS1 Barcode Syntax Engine** (release 1.4.1, build WebAssembly in `src/vendor/gs1/syntax-engine`) per applicare tutte le regole del GS1 Barcode Syntax Dictionary:

- formato e contenuto di ogni AI (date, cifre di controllo, caratteri ammessi);
- combinazioni di AI vietate (es. 01 con 37) e AI obbligatori (es. 21 richiede 01);
- la sintassi del GS1 Digital Link letto.

Gli errori compaiono nella fascia di conformità, tradotti in italiano, con il dato errato evidenziato.

## Rapporto di verifica (PDF)

Dalla scheda dell'esito si genera un PDF sul dispositivo (`src/report/pdf.ts`, jsPDF). Contiene il simbolo letto, la conformità GS1, i dati codificati, la verifica Verified by GS1 con i 7 dati essenziali, l'esito dei controlli sul link e l'elenco dei controlli eseguiti. Sul telefono si condivide, sul computer si scarica.

## Elenchi di siti malevoli (Google Web Risk)

Il Worker espone `POST /api/linkcheck`, che interroga Google Web Risk (`uris.search`) e tiene l'esito in cache per un'ora. Il controllo si attiva quando è presente il secret `WEB_RISK_API_KEY`:

1. Progetto Google Cloud con fatturazione attiva (Web Risk Lookup API: gratuita fino a 100.000 richieste al mese).
2. Attiva la **Web Risk API** e crea una chiave API limitata a quella API.
3. `npx wrangler secret put WEB_RISK_API_KEY`

Senza chiave l'app funziona, e nel rapporto il controllo risulta "Non attivo".

## Protezione da quishing e phishing

Un GS1 Digital Link può stare su qualsiasi dominio, quindi un QR Code Standard GS1 con un GTIN autentico può comunque puntare a un sito truffa. `src/gs1/linkSafety.ts` valuta ogni link letto e la card "Link nel QR Code Standard GS1" (subito sotto il codice) lo mostra separato dalla verifica del prodotto:

- **Link verificato**: il dominio è `id.gs1.org` oppure è tra i link o il sito web registrati dal titolare del codice su Verified by GS1. Il link si apre direttamente.
- **Dominio non riconosciuto**: il pulsante principale apre lo stesso codice tramite il resolver GS1 (`id.gs1.org`); il link originale si apre solo dopo una conferma che mostra il dominio.
- **Link sospetto**: dominio che imita uno registrato (es. `bariila.com` invece di `barilla.com`), caratteri internazionali (`xn--`), una "@" che nasconde il dominio, oppure un indirizzo IP.
- Vengono segnalati anche i collegamenti in `http` e i link accorciati. I codici che contengono un link qualsiasi, senza dati GS1, passano sempre dalla conferma.

Terminologia: un codice QR con dati GS1 è sempre chiamato "QR Code Standard GS1". Un codice QR senza dati GS1 non viene chiamato così ("Codice con link" / "Codice con testo"), per non attribuirgli una conformità che non ha.

Nessun link si apre automaticamente dopo una scansione.

## Statistiche sulle scansioni (Supabase)

Ogni scansione completata (fotocamera, foto o inserimento manuale) invia un evento al Worker (`POST /api/events`), che aggiunge paese e regione dedotti da Cloudflare e lo salva nella tabella `scan_events` del progetto Supabase `bpgdftmvduzahbczxiik` (regione UE, Francoforte).

- **Nessun dato personale**: niente IP né identificativi di dispositivo; dei link si salva solo il dominio.
- **Accesso**: scrive solo il Worker con la chiave segreta (`SUPABASE_SECRET_KEY`); il pubblico non può leggere né scrivere (RLS attiva, nessuna policy).
- **Schema**: `supabase/schema.sql`, da eseguire nel SQL Editor. `supabase/retention.sql` cancella gli eventi più vecchi di 24 mesi.
- **Viste**: `barometro_2d`, `benchmark_categoria`, `qualita_errori`, `allerte_brand`, `prefissi_non_assegnati`. Quelle destinate a uscire mostrano solo gruppi con almeno 10 letture.
- **Codice**: `src/analytics/events.ts` (lato app) e `events()` in `worker/index.ts`.

## Token API Verified by GS1

L'API non abilita il CORS, quindi il browser non può chiamarla direttamente. Il browser chiama `/api/vbg/...` e il proxy di Vite (`vite.config.ts`) inoltra a `https://api.vbg.gs1it.org/v2/...` aggiungendo `Authorization: Token …` lato server.

```sh
cp .env.example .env.local   # poi inserisci VBG_API_TOKEN
```

- Il token sta in `.env.local` (escluso da git) senza prefisso `VITE_`, quindi **non finisce nel bundle** né nelle richieste del browser.
- In sviluppo (`npm run dev`, `npm run preview`) il proxy è quello di Vite.
- L'app è pubblicata solo su **GitHub Pages**: https://marcoruberto-gs1it.github.io/gs1-italy-vbg-app/ . Il Worker Cloudflare (https://gs1-vbg-scan.marco-ruberto.workers.dev) espone solo le API e reindirizza ogni altra richiesta all'app su Pages.

## Pubblicazione su GitHub Pages

A ogni push su `main` il workflow `.github/workflows/pages.yml` compila l'app e la pubblica su https://marcoruberto-gs1it.github.io/gs1-italy-vbg-app/.

- `BASE_PATH` imposta il percorso `/gs1-italy-vbg-app/`.
- `VITE_VBG_BASE` punta il frontend al proxy del Cloudflare Worker, perché Pages serve solo file statici.
- Il Worker accetta chiamate da altri domini solo da `https://marcoruberto-gs1it.github.io` (`ALLOWED_ORIGINS` in `worker/index.ts`). Se cambia il dominio, aggiornalo lì e ripubblica il Worker.

## Worker Cloudflare (API)

`worker/index.ts` espone solo le API (`/api/vbg/<chiave>/`, `/api/linkcheck`, `/api/events`); l'app è su GitHub Pages. Aggiunge il token, che è un secret di Cloudflare, e accetta un solo codice per richiesta, solo in POST e solo sugli endpoint di lettura dell'app, con un limite di 30 richieste al minuto per IP. La configurazione è in `wrangler.jsonc`.

```sh
npx wrangler login                        # una volta
npx wrangler secret put VBG_API_TOKEN     # una volta, o per sostituire il token
npm run deploy                            # pubblica il Worker (solo API)
npm run worker:dev                        # prova locale del Worker (secret in .dev.vars, escluso da git)
```

## Licenze

Il codice GS1 incluso è distribuito con licenza Apache 2.0 (`src/vendor/gs1/LICENSE`).
