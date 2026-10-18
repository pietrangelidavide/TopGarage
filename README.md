# AutoProfit · Top Garage

Versione di AutoProfit per Top Garage: sito con le auto in vetrina, «Chi siamo» con anteprima Instagram e recensioni Google, prenotazione delle visite con calendario e «Vendi la tua auto» (dati e almeno 4 foto); gestionale per auto, contatti, agenda con orari modificabili dal titolare, valutazioni delle auto da acquistare, stima del prezzo e «quanto pagare».
Tutto ciò che cambia da un garage all'altro sta in **public/garage.json** (nome, contatti, orari, colori, caratteri, regole di calcolo, privacy) e nella cartella **public/img** (marchio).

## Cosa c'è
- `public/` il sito (`index.html`), il gestionale (`gestionale/`), l'informativa (`privacy.html`) e la configurazione.
- `src/` il piccolo servizio Cloudflare (Worker) per archivio online, prenotazioni e prezzi di mercato.
- `wrangler.jsonc` la configurazione di Cloudflare, con il nome del progetto `autoprofit-topgarage` (nuovo: non tocca i siti già online).

## Da completare prima di andare online
- Ragione sociale esatta (oggi c'è «Top Garage»): compare in fondo al sito e nell'informativa privacy.
- Sezione «Chi siamo» (garage.json › chiSiamo): il testo l'ho scritto con le informazioni pubbliche dell'annuncio. Va riletto e riscritto con le vostre parole.
- Anteprima di Instagram (garage.json › social › instagram): Instagram non permette a un programma di leggere il profilo, quindi bio, numero di post, follower, seguiti e le immagini si scrivono a mano. Le immagini vanno in public/img/instagram/ (ad esempio "img/instagram/1.jpg"). Senza queste cose l'anteprima mostra il nome del profilo e le auto in vetrina.
- Recensioni di Google (due modi): (a) vere e sempre aggiornate: in wrangler.jsonc scrivete GOOGLE_PLACE_ID (il Place ID della scheda Google di Top Garage) e in Cloudflare aggiungete il secret GOOGLE_PLACES_KEY (chiave Google Cloud con «Places API (New)» attiva); (b) a mano: riscrivete public/data/recensioni.json con il voto, il numero e le recensioni vere. Quelle che trovate ora sono di ESEMPIO (hanno l'etichetta «Esempio»): non lasciatele online.
- Orari delle visite: partono da quelli scelti da AutoProfit (garage.json › visite › orari); il titolare li cambia dal gestionale, Visite › Orari delle visite, senza toccare il file (serve l'archivio online). Chiusure per ferie e festività: nel gestionale oppure in visite › chiusure (ci sono solo le principali).
- Durata della visita e numero di persone che possono riceverne insieme (visite › durata, posti, o dal gestionale).
- «Vendi la tua auto» (moduli › vendi): le richieste con le foto compaiono nel gestionale, scheda «Valutazioni», solo con l'archivio online attivo. Dati e foto si cancellano dopo 6 mesi (privacy › conservazione › richieste_mesi).
- Costi di vendita, costo al giorno e margine minimo (regole): sono valori di partenza, da sostituire con i vostri.
- WhatsApp: se lo usate per i clienti, scrivete il numero in contatti › whatsapp (con prefisso, senza spazi).

Le auto che trovi all'inizio sono di **esempio** (hanno l'etichetta «Esempio»): dal gestionale, in fondo all'elenco, «Elimina i dati di esempio». Poi inserisci le auto vere o importa un CSV.

## Metterlo online (Cloudflare)
1. Carica questa cartella in un repository GitHub (o usa `npx wrangler deploy`).
2. Cloudflare › Workers & Pages › Create › collega il repository. Il nome deve essere quello di `wrangler.jsonc`.
3. Il sito funziona subito. Il gestionale resta «solo su questo browser» e le prenotazioni dal sito restano chiuse (il sito mostra il telefono) finché non attivi l'archivio online:
   - Storage & Databases › D1 › Create database. Copia il Database ID.
   - In `wrangler.jsonc` togli i `//` dal blocco `d1_databases` e incolla l'ID.
   - Settings › Variables and Secrets › Secret `GESTIONALE_PASSWORD` (almeno 10 caratteri).
4. Apri `/gestionale/`, accedi con la password: auto, contatti, visite, richieste di valutazione e foto si allineano tra telefono e computer.
5. (Facoltativo) Recensioni vere di Google: `GOOGLE_PLACE_ID` in `wrangler.jsonc` e secret `GOOGLE_PLACES_KEY`. Finché mancano, il sito mostra `public/data/recensioni.json` (oggi: esempi).

## Cose da sapere (limiti veri)
- **Prezzi di mercato.** «Quanto vendere» e «quanto pagare» compaiono subito, senza collegare portali e senza inserire annunci. Sono una **stima di riferimento**, non una rilevazione di annunci: il programma parte dal prezzo di listino medio del modello e applica la svalutazione per età, chilometri, alimentazione, cambio e marca (ordini di grandezza pubblici, tra cui Quattroruote Professional e SicurAuto; controllati a mano su alcuni annunci). Il gestionale la mostra sempre come «stima di riferimento» con un margine di errore (di solito ±7%), e la corregge da sola con le **vendite già fatte dal garage** (da 3 vendite in poi). Non legge AutoScout24 né altri portali: non hanno un'API pubblica e le loro condizioni vietano di copiare i dati con programmi propri. Per affinarla il titolare può incollare almeno 6 annunci veri (sostituiscono la stima), oppure collegare un feed autorizzato (`mercato.fonte = "feed"` o `"auto"` con le variabili `MERCATO_URL` e `MERCATO_KEY` in `wrangler.jsonc`). Con `"fonte": "esempio"` il gestionale dichiara che i prezzi sono di esempio.
- **Prova.** L'archivio e le prenotazioni sono stati provati solo con un database simulato in locale, non su Cloudflare vero: alla prima messa online fai una prenotazione di prova e controlla che compaia nell'agenda.
- **Privacy.** L'informativa (`privacy.html`) è un modello. Finché non la fa verificare un legale e non metti `"verificata": true` in `privacy`, mostra l'avviso «modello da verificare». Serve anche il contratto di nomina a responsabile tra Top Garage e ENA ONE STUDIO. Lo studio completo è nel documento «AutoProfit · Privacy dei clienti».
- **Caratteri.** Michroma (titoli) e Archivo (testi) sono inclusi nel sito (`public/fonts/`, licenza SIL Open Font License): il sito non chiede nulla a Google Fonts. Se cambi i caratteri in `garage.json › tema`, scrivi `"locale": true` solo per quelli che aggiungi tu in `public/fonts/`; gli altri vengono presi da Google Fonts (e l'informativa lo dice).
- **Loghi delle marche.** I loghi in `public/img/marche/` (da un archivio pubblico di loghi di auto) sono marchi dei rispettivi proprietari e servono solo a riconoscere la marca nell'elenco delle auto, nella flotta e nell'inserimento; non vanno usati per altro.
- **Mappa in «Dove siamo».** Prima compare un disegno con l'indirizzo e un pulsante «Mostra la mappa»: solo dopo il clic il sito carica la mappa di Google (che riceve l'indirizzo IP e può usare cookie propri), come dice l'informativa. In `garage.json` si può aggiungere `"mappa": { "attiva": true, "caricaSubito": false, "ricerca": "Via Appia Nuova 31, Marino RM", "zoom": 16 }`. Con `"caricaSubito": true` la mappa compare subito, ma allora serve il consenso ai cookie di terzi (banner). Il caricamento vero della mappa di Google non è stato provato (l'ambiente di sviluppo non raggiunge Google): alla prima messa online controlla che compaia dopo il clic.
- **Pubblicare le novità.** Il titolare lavora nel gestionale (Riepilogo, In vendita, Vendute…) e quando ha cambiato qualcosa preme «Pubblica sul sito»: vede cosa cambia e riceve un file da mandare (WhatsApp, e-mail) a chi cura il sito. Con l'archivio online attivo non serve: ogni modifica va sul sito da sola e il pulsante non compare.
- **Instagram.** L'anteprima del profilo non è letta da Instagram (non lo permette): mostra ciò che scrivi in `social › instagram`. Il link porta al profilo vero, senza codici di tracciamento.
- **Recensioni di Google.** Il voto, il numero e le recensioni sono veri solo con Place ID e chiave collegati; altrimenti sono quelli d'esempio di `public/data/recensioni.json`, e il sito lo scrive.
- **«Vendi la tua auto».** Le foto delle richieste non sono pubbliche: le vede solo chi entra nel gestionale. Le richieste e le loro foto si cancellano da sole dopo 6 mesi; dal gestionale si possono cancellare prima. L'informativa va aggiornata e verificata da un legale (nuovo trattamento: dati e foto di chi vuole vendere).
- **Orari delle visite.** Se il titolare li cambia dal gestionale valgono quelli, al posto di `garage.json`; «Torna agli orari di partenza» li azzera.

## Provarlo in locale
`node --no-warnings _work/dev.mjs` (nel progetto completo di sviluppo) serve `public/` con un archivio simulato. Password di prova: `prova-password-123`.
