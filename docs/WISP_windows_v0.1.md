# Wisp — compagno per la focus · versione Windows v0.1

Incolla questo prompt in Claude Code in una cartella vuota, insieme al file `assets/wisp.svg`.

---

## Contesto

Voglio costruire **Wisp**, una piccola app desktop: un fantasmino che vive in alto al centro dello schermo e mi aiuta durante la giornata a non perdere il focus e a tenere traccia di cosa sto facendo. Ho l'ADHD: l'app serve a rendere visibili le cose che per me spariscono, cioè il tempo che passa, il compito che stavo facendo e le idee che mi vengono a metà lavoro.

Ci saranno **due versioni**: questa per **Windows** (il PC dell'ufficio) è la prima. Una versione per **macOS** (il mio MacBook, dove Wisp vivrà sotto il notch) verrà dopo, come progetto a parte. Progetta questa in modo che la logica si possa riusare.

È ispirata a Mochi di Coucou (un personaggio che reagisce agli eventi), ma personaggio, nome e grafica sono originali. Diventerà una repo pubblica su GitHub.

La scrivo in **Rust** anche per impararlo. Io automatizzo soprattutto con n8n e strumenti AI e non scrivo codice da zero: quando compaiono concetti tipici di Rust (ownership, borrowing, `Result`, trait, lifetimes) spiegameli in due righe, nel commento del codice o nel messaggio, senza lezioni lunghe. Preferisco codice leggibile a codice ingegnoso.

## Principi di prodotto (vincolanti)

1. **Zero registrazione manuale.** Ogni campo da compilare è una cosa che smetterò di fare dopo tre giorni. L'unico input obbligatorio è il compito attuale.
2. **Una cosa sola alla volta.** Mai una lista di compiti nella vista principale.
3. **Niente sensi di colpa.** Wisp non rimprovera mai. Toni gentili, nessun conteggio di "fallimenti", nessun rosso aggressivo.
4. **Discreto.** Niente notifiche di sistema in v0.1: è il personaggio stesso a comunicare cambiando stato.
5. **Tutto in locale.** Nessun dato esce dal computer.

## Stack

- **Tauri 2**: backend in **Rust**, interfaccia in WebView2
- Frontend: **Vite + TypeScript semplice + SVG**, senza framework UI (se ti sembra davvero necessario, proponimi Svelte prima di usarlo)
- Database: **SQLite** con `rusqlite` (feature `bundled`) e migrazioni versionate (`rusqlite_migration` o equivalente)
- Plugin Tauri: `global-shortcut`, `autostart`; icona nella tray con le API di Tauri
- Qualità: `cargo fmt`, `cargo clippy`, `cargo test`; ESLint + Prettier sul frontend
- Codice, nomi e commenti in **inglese**; testi dell'interfaccia in **italiano**, centralizzati in `src/i18n/it.ts`

## Architettura

La regola più importante: **la logica sta in Rust, il frontend disegna e basta**.

```
src-tauri/
  src/
    core/              # crate o modulo SENZA dipendenze da Tauri: riusabile dalla versione Mac
      state_machine.rs # stato di Wisp: funzione pura (input → stato), con test
      timer.rs         # timer di focus
      models.rs        # Task, FocusSession, ParkedIdea, Settings
    db/                # connessione, migrazioni, query
    platform/
      windows.rs       # posizionamento finestra, monitor, DPI
      mod.rs           # interfaccia comune (la versione Mac aggiungerà la sua)
    integrations/      # vuota in v0.1: definisci solo un trait `Integration` che emette eventi verso la state machine, con un README
    commands.rs        # comandi IPC esposti al frontend
    main.rs
src/                   # frontend
  character/           # componente SVG parametrico di Wisp + animazioni
  island/              # vista chiusa e vista aperta
  park/                # finestrella del parcheggio idee
  i18n/it.ts
assets/wisp.svg
```

Il backend manda al frontend un evento `wisp://state` ogni volta che lo stato cambia; il frontend non decide mai lo stato da solo.

## L'isola (la finestra di Wisp)

Wisp vive in un'**"isola" nera attaccata al bordo superiore dello schermo, al centro**: la stessa idea che su Mac sarà il notch.

**Chiusa** (normale):
- Finestra senza bordi, trasparente, sempre in primo piano, non visibile nella barra delle applicazioni, circa 300×84 px
- Dentro: una barra nera 240×30 px con gli angoli inferiori arrotondati (raggio 14) e, sulla destra, i minuti del timer in bianco con un puntino del colore della palette
- Wisp, alto circa 72 px, **sbircia da sotto l'isola**: la parte alta del corpo è nascosta dietro la barra nera, si vedono occhi, guance, bocca e codina

**Aperta** (passando il mouse sopra l'isola):
- L'isola si allarga verso il basso in un pannello nero di circa 540×236 px, angoli inferiori con raggio 30, ombra morbida
- A sinistra Wisp intero (circa 150 px); a destra:
  - etichetta "Adesso" (piccola, grigia, maiuscolo)
  - il compito attuale, modificabile al clic
  - timer grande con barra di avanzamento
  - pulsanti **Pausa** e **Fatto**
  - riga in basso: "N idee parcheggiate · Ctrl+Shift+Spazio per aggiungerne una" (cliccabile per vederle)
- Si richiude 600 ms dopo che il mouse esce, **tranne** se sto scrivendo in un campo
- Transizione apertura/chiusura morbida (circa 250 ms)

Suggerimento tecnico da valutare: invece di una finestra grande con zone "trasparenti al clic", **ridimensiona la finestra** tra chiusa e aperta, così non copre mai altro. Dimmi tu se c'è un modo migliore.

**Altre regole:**
- Monitor principale; si riposiziona se cambiano monitor, risoluzione o scala (DPI)
- Impostazione posizione: **"In alto al centro"** (default) oppure **"In basso a destra, sopra la barra delle applicazioni"**, per quando l'isola in alto dà fastidio alle finestre massimizzate
- Icona nella tray con menu: Mostra/Nascondi, Impostazioni, Avvio automatico con Windows, Esci

## Cosa fa la v0.1

1. **Compito attuale.** Un solo campo: "Su cosa stai lavorando?". **Fatto** → Wisp va nello stato "Fatto!" per 4 secondi, il compito finisce nello storico di oggi, il campo si svuota.
2. **Timer di focus.** Durate rapide 15, 25, 45 minuti più una personalizzata; Avvia / Pausa / Ferma; tempo rimanente sempre visibile sull'isola chiusa.
3. **Parcheggio idee.** Scorciatoia globale `Ctrl+Shift+Spazio` (configurabile) apre una finestrella con un campo di testo al centro dello schermo. Scrivo, Invio salva e la chiude, Esc annulla. Dopo, il focus deve **tornare alla finestra su cui stavo lavorando**. Le idee si vedono dal pannello aperto, con data e ora, e si possono segnare come viste o eliminare.
4. **Stati di Wisp** (vedi sotto), decisi dalla state machine in Rust.
5. **Persistenza** in SQLite nella cartella dati dell'app. Tabelle minime: `tasks`, `focus_sessions`, `parked_ideas`, `settings`.
6. **Menu debug**: solo nelle build di sviluppo, un sottomenu nella tray per forzare ciascuno dei sei stati.
7. **Build automatica**: un workflow GitHub Actions su `windows-latest` che a ogni tag `v*` produce l'installer (`.msi` o `.exe` NSIS) come artifact della release. Mi serve per installarlo sul PC dell'ufficio anche se sviluppo dal Mac.

## Gli stati

| Stato | Quando (v0.1) |
|---|---|
| `focused` (Concentrato) | default; timer attivo o nessun evento particolare |
| `distracted` (Distratto) | **non automatico in v0.1** (arriverà con il tracciamento della finestra attiva); solo dal menu debug |
| `break` (Fai una pausa) | lavoro continuativo oltre una soglia (default 90 minuti di timer senza pause), configurabile |
| `waiting` (Ti aspetta) | il timer è appena finito; resta finché non apro l'isola |
| `done` (Fatto!) | 4 secondi dopo aver premuto Fatto, poi torna allo stato precedente |
| `night` (Buonanotte) | dopo un orario configurabile (default 23:00) |

Priorità se più regole sono vere: `done` > `waiting` > `night` > `break` > `distracted` > `focused`. Scrivi test Rust per le priorità e le soglie, iniettando l'ora corrente come parametro (niente `now()` dentro la logica).

## Il personaggio: Wisp

Base grafica: `assets/wisp.svg` (stato Concentrato, palette Lilla, viewBox 120×120). Costruiscilo come **componente SVG parametrico**: stessi elementi, cambiano solo gli attributi in base allo stato. Lo stile è **pseudo-3D morbido**, come un mochi.

**Strati, dal basso:**
1. ombra a terra sfumata (blur) + una leggera luce riflessa del colore del corpo, fuori dal gruppo che galleggia
2. braccine (stesso gradiente del corpo)
3. corpo tondo con codina arricciata a destra, riempito con un gradiente radiale con la luce in alto a sinistra
4. luce calda che "attraversa" la base (ellisse sfumata, ritagliata sulla forma del corpo)
5. bordo illuminato sul lato in ombra: il corpo meno una sua copia sfocata spostata di (−3.5, −3.5), usata come maschera
6. riflessi: uno morbido grande, uno netto piccolo, due puntini
7. guance sfumate, occhi lucidi (gradiente + due riflessi), bocca

**Colori derivati dal colore base di ogni stato:**
- luce = mix(base, bianco, 0.65) · ombra = mix(base, colore ombra della palette, 0.5)
- luce attraverso la base = mix(base, colore caldo della palette, 0.7) · bordo = mix(base, bianco, 0.75)

| Palette | Base | Chiaro (Fatto) | Spento (Pausa) | Notte | Ombra | Caldo |
|---|---|---|---|---|---|---|
| Lilla | #DCD5FB | #E9E4FF | #D2CDE2 | #BDB6DD | #6E5FB8 | #F9CBEB |
| Menta | #C9EEDF | #DDF7EC | #CFDDD7 | #A9CFC1 | #3F8F7A | #FFF5C8 |
| Pesca | #FFD8C6 | #FFE6DA | #E7D6CF | #E0B8A8 | #C9735C | #FFEFC2 |

Inchiostro di occhi e bocca: #2A2433. Guance: #FF8FA3.

**Occhi** (centri x=47 e x=71, y=64): `dot` ellissi piene rx 4.2 ry 5.6 · `side` come dot spostati di (+2.6, −1) · `wide` rx 5 ry 6.6 · `tired` linea con mezzo arco sotto · `happy` archi ∩ · `closed` archi ∪.
**Bocca** (centro x=59, y=72): `calm` "w" piccola · `wavy` ondulata · `flat` lineetta · `o` piccola ellisse piena · `grin` mezzaluna piena · `sleep` puntino.
**Braccia:** `down` ai lati (cx 26/94, cy 74, ruotate ±28°) · `up` alzate (cx 24/96, cy 50, ruotate ∓30°).

| Stato | Occhi | Bocca | Braccia | Colore | Opacità corpo | Corpo | Simbolo |
|---|---|---|---|---|---|---|---|
| focused | dot | calm | down | base | 1 | — | — |
| distracted | side | wavy | down | base | **0.4** | inclinato −8° | ? arancione |
| break | tired | flat | down | spento | 0.92 | schiacciato (1.06 × 0.92 dalla base) | goccia di sudore azzurra |
| waiting | wide | o | **up** | base | 1 | sollevato di 6 | ! su cerchio blu |
| done | happy | grin | **up** | chiaro | 1 | sollevato di 4, alone giallo dietro | scintille gialle |
| night | closed | sleep | down | notte | 0.95 | abbassato di 5 | "z z" grigie |

L'idea da preservare: **quando mi distraggo Wisp diventa trasparente**, come se sparisse insieme alla mia attenzione. La faccia resta visibile.

**Animazioni:** galleggiamento ±3 px in 3.2 s ease-in-out, con l'ombra che pulsa in sincrono; transizioni tra stati di circa 300 ms; battito di ciglia casuale ogni 3–6 s con occhi aperti; con `prefers-reduced-motion` niente galleggiamento né battiti.

## Fuori dalla v0.1 (non implementarli, ma non chiudere la porta)

- v0.2: hook di Claude Code e GitHub (progetti tracciati in automatico dai commit)
- v0.3: finestra attiva su Windows → `distracted` automatico e rilevamento dell'iperfocus
- v0.4: calendario → avvisi 10 minuti prima dei passaggi
- v0.5: riepilogo serale via n8n (webhook)
- Versione macOS con il notch: progetto successivo che riusa `core/`

## Come voglio lavorare

1. **Prima di scrivere codice**: controlla i prerequisiti (rustup, Node, Visual Studio Build Tools con il workload C++ su Windows, WebView2) e dimmi cosa manca. Poi mostrami un piano breve: struttura, crate e plugin scelti, dubbi su questo prompt. Aspetta il mio ok.
2. Procedi per passi piccoli, ognuno avviabile con `npm run tauri dev` e con un commit:
   1. l'isola chiusa in alto al centro con Wisp fermo, e la tray
   2. stati e menu debug, con il personaggio animato
   3. isola aperta al passaggio del mouse
   4. compito e timer
   5. parcheggio idee con la scorciatoia globale
   6. persistenza SQLite
   7. workflow GitHub Actions per l'installer
3. Alla fine di ogni passo dimmi cosa provare a mano.
4. Scrivi un `README.md` in inglese (cos'è, screenshot da aggiungere, come avviarlo, come installarlo) e un `CLAUDE.md` con le convenzioni del progetto per le sessioni future.

## Fatto quando

- [ ] L'isola appare in alto al centro, sempre in primo piano, fuori dalla barra delle applicazioni, con Wisp che sbircia da sotto
- [ ] Il menu debug mostra correttamente tutti e sei gli stati, con transizioni morbide
- [ ] Passando il mouse l'isola si apre e si richiude da sola
- [ ] Imposto un compito, avvio un timer da 15 minuti, vedo i minuti scendere; a fine timer Wisp passa a "Ti aspetta"
- [ ] "Fatto" fa festeggiare Wisp e salva il compito
- [ ] `Ctrl+Shift+Spazio` parcheggia un'idea e mi riporta alla finestra su cui lavoravo
- [ ] Chiudendo e riaprendo l'app, compiti, idee e impostazioni ci sono ancora
- [ ] Cambiando monitor o scala dello schermo l'isola resta al suo posto
- [ ] `cargo test` e `cargo clippy` passano senza errori
- [ ] Un tag `v0.1.0` produce l'installer Windows su GitHub
