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
- **Dati GS1**: [GS1 Digital Link Toolkit](https://github.com/gs1/GS1DigitalLinkToolkit.js) ufficiale, incluso in `src/vendor/gs1`, più la logica di [interpretGS1scan](https://github.com/gs1/interpretGS1scan), portata in `src/gs1/interpret.ts`. Legge GTIN, element string con parentesi o FNC1 e URI GS1 Digital Link, anche compressi. Controlla la cifra di controllo, ricava l'organizzazione GS1 che ha assegnato il prefisso e costruisce il Digital Link su `id.gs1.org`.
- **Categorie GPC**: `src/vendor/gs1/gpc-bricks-it.json` contiene i nomi italiani dei brick GPC (pubblicazione GS1 di maggio 2026, traduzione di GS1 Italy), caricati solo alla prima verifica.
- **Verified by GS1**: `src/gs1/vbg.ts` interroga l'API di GS1 Italy (`https://api.vbg.gs1it.org/v2`, endpoint `gtin`, `gln`, `sscc`, `grai`, …) e mostra se il codice è verificato, solo registrato o non valido, con prodotto, titolare e link del produttore.

## Token API Verified by GS1

L'API non abilita il CORS, quindi il browser non può chiamarla direttamente. Il browser chiama `/api/vbg/...` e il proxy di Vite (`vite.config.ts`) inoltra a `https://api.vbg.gs1it.org/v2/...` aggiungendo `Authorization: Token …` lato server.

```sh
cp .env.example .env.local   # poi inserisci VBG_API_TOKEN
```

- Il token sta in `.env.local` (escluso da git) senza prefisso `VITE_`, quindi **non finisce nel bundle** né nelle richieste del browser.
- In sviluppo (`npm run dev`, `npm run preview`) il proxy è quello di Vite.
- In produzione l'app gira su **Cloudflare Workers** (piano gratuito): https://gs1-vbg-scan.marco-ruberto.workers.dev

## Pubblicazione su GitHub Pages

A ogni push su `main` il workflow `.github/workflows/pages.yml` compila l'app e la pubblica su https://marcoruberto-gs1it.github.io/gs1-italy-vbg-app/.

- `BASE_PATH` imposta il percorso `/gs1-italy-vbg-app/`.
- `VITE_VBG_BASE` punta il frontend al proxy del Cloudflare Worker, perché Pages serve solo file statici.
- Il Worker accetta chiamate da altri domini solo da `https://marcoruberto-gs1it.github.io` (`ALLOWED_ORIGINS` in `worker/index.ts`). Se cambia il dominio, aggiornalo lì e ripubblica il Worker.

## Pubblicazione su Cloudflare

`worker/index.ts` serve l'app (build di Vite, come file statici) e risponde solo su `/api/vbg/<chiave>/`. Aggiunge il token, che è un secret di Cloudflare, e accetta un solo codice per richiesta, solo in POST e solo sugli endpoint di lettura dell'app, con un limite di 30 richieste al minuto per IP. La configurazione è in `wrangler.jsonc`.

```sh
npx wrangler login                        # una volta
npx wrangler secret put VBG_API_TOKEN     # una volta, o per sostituire il token
npm run deploy                            # build + pubblicazione
npm run worker:dev                        # prova locale del Worker (token in .dev.vars, escluso da git)
```

## Licenze

Il codice GS1 incluso è distribuito con licenza Apache 2.0 (`src/vendor/gs1/LICENSE`).
