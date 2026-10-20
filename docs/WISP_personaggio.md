# Wisp — rifacciamo il personaggio (SVG + molle in TypeScript)

Prompt per Claude Code. Metti questo file in `docs/` insieme a `docs/wisp-reference.html`.

---

## Cosa voglio

Rifai **solo il personaggio** di Wisp. Oggi è un SVG con pose fisse per stato. Lo voglio **vivo**: fluido, dinamico e interattivo. Deve seguirmi con lo sguardo e girarsi verso di me, schiacciarsi quando lo clicco e rimbalzare, cambiare espressione sfumando da una all'altra, e muoversi da solo quando lo lascio stare.

Il riferimento funzionante è **`docs/wisp-reference.html`**: aprilo nel browser per vedere il comportamento che voglio. È JavaScript semplice in un solo file. La **logica** va ripresa (molle, parametri, geometria, valori numerici); la **struttura del codice** va rifatta come descritto sotto.

Ispirazione: il personaggio Mochi dell'app Coucou, ma **solo per il comportamento**. Aspetto, forma e nome di Wisp restano i nostri. Non copiare nulla della grafica di Mochi.

Non toccare il resto dell'app (isola, timer, parcheggio idee, database, state machine in Rust), salvo dove indicato in "Integrazione".

## Le tre idee alla base

1. **Ogni parte è una molla, non un'animazione registrata.** Posizione, schiacciamento, sguardo, braccine, codina, espressione e colore inseguono ciascuno un obiettivo con una molla smorzata (rigidità `k`, smorzamento `c`, Eulero semi-implicito). Lo stato dell'app cambia gli **obiettivi**, mai i valori direttamente. Per questo non ci sono mai scatti.
2. **"Si gira" con il trucco del 2.5D.** Lo sguardo `look = (x, y)` in −1..1 fa scivolare faccia, occhi e guance verso quella direzione. L'occhio e la guancia dalla parte opposta si stringono (scorcio), i riflessi di luce si spostano al contrario (la luce resta ferma nel mondo), il bordo illuminato si sposta e il corpo si stringe di pochissimo in orizzontale. Il disegno è piatto, ma si legge come una rotazione.
3. **Espressioni continue.** Occhi e bocca non sono disegni diversi da scambiare: sono **una sola forma** calcolata da pochi parametri. Passare da "concentrato" a "felice" è una curva che si deforma.

## Parametri dell'espressione

| Parametro | Significato |
|---|---|
| `open` | apertura occhi: 1 normale, >1 spalancati, ~0 linea (battito), <0 chiusi a ∪ |
| `happy` | 0..1, la palpebra inferiore sale e gli occhi diventano ∩ |
| `smile` | curvatura bocca, −1 triste … 1 sorriso |
| `mo`, `mw` | apertura bocca 0..1, mezza larghezza bocca |
| `blush` | intensità guance |
| `op` | opacità del corpo (la faccia resta sempre visibile) |
| `arm` | braccine 0 giù … 1 alzate |
| `rise` | spostamento verticale |
| `glow` | alone dorato dietro |
| `q`, `sweat`, `bang`, `spark`, `z` | opacità dei simboli |

**Occhi**: due curve cubiche, palpebra superiore `top = 5.6 × open` e inferiore `bottom = top − 7.5 × happy`, con i punti di controllo agli estremi per una forma tonda e non a mandorla. Riflessi visibili solo con l'occhio abbastanza aperto e non felice.
**Bocca**: una forma chiusa con labbro superiore curvato da `smile` e labbro inferiore che scende di `mo`; il riempimento compare solo quando la bocca è aperta.

I valori esatti degli stati e delle reazioni sono in `wisp-reference.html` (`STATES`, `REACT`, `PALS`): usa quelli.

## Comportamenti

**Stati dell'app** (gli stessi sei di prima, arrivano dal backend): ognuno è un set di obiettivi più un tono di colore e un simbolo. In più:
- `distracted`: guarda via (sguardo fisso in alto a destra) e diventa trasparente
- `waiting`: saltella ogni 1.6 s per chiamarmi
- `done`: saluta agitando le braccine
- `night`: galleggia più lento e più basso, occhi chiusi; se mi avvicino socchiude un occhio

**Interazioni:**
- **Mouse vicino**: mi segue con lo sguardo, si alza un po', occhi più aperti, braccine leggermente su
- **Clic tenuto premuto**: si schiaccia (squash), occhi stretti
- **Rilascio**: rimbalza (spinta alla molla di schiacciamento + saltello) e ridacchia per circa 0.9 s
- **Trascinamento**: si allunga nella direzione del movimento (stretch in base alla velocità), guarda dove va, bocca a "o"; lasciato, torna al suo posto ondeggiando, con codina e braccine che arrivano in ritardo
- **Carezza**: se passo il mouse avanti e indietro sopra di lui (movimento orizzontale accumulato > soglia, che decade nel tempo) arrossisce e brilla
- **Clic quando è distratto**: torna pieno per la durata della reazione
- **Lasciato stare**: dopo qualche secondo senza mouse si guarda intorno a caso, sbatte le palpebre ogni 2.5–6 s e ogni tanto fa un saltello

**Sempre**: galleggiamento leggero (±3 unità in 3.2 s), ombra a terra che si rimpicciolisce e sbiadisce quando si alza, codina che ondeggia, colore che sfuma verso quello dello stato.

**Accessibilità e risorse:** con `prefers-reduced-motion` niente galleggiamento, saltelli né battiti di ciglia; le transizioni restano. Il loop `requestAnimationFrame` si **ferma quando la finestra non è visibile**. Aggiorna solo gli attributi degli elementi SVG creati una volta: niente `innerHTML` a ogni frame.

## Struttura del codice

```
src/character/
  spring.ts       # molla smorzata: step(value, velocity, target, k, c, dt)
  params.ts       # STATES, REACT, PALETTES, tipi
  geometry.ts     # funzioni PURE: parametri → path e attributi (corpo, occhi, bocca, braccia, riflessi)
  sim.ts          # simulazione: aggiorna molle e obiettivi a ogni frame (niente DOM qui)
  input.ts        # pointer: vicinanza, clic, trascinamento, carezza
  render.ts       # crea l'SVG una volta e applica gli attributi a ogni frame
  index.ts        # API pubblica
```

API pubblica:

```ts
const wisp = createWisp(container: HTMLElement, options: { palette: PaletteId; size: number; mode: 'free' | 'island' });
wisp.setState(state: WispState);       // dal backend
wisp.setPalette(palette: PaletteId);
wisp.setLookTarget(x: number, y: number) // coordinate esterne opzionali (vedi Integrazione)
wisp.poke();                           // come un clic: per tastiera e test
wisp.destroy();
```

Tutto in TypeScript `strict`, senza librerie di animazione.

## Integrazione con l'isola

L'isola chiusa è piccola: le interazioni vanno adattate.

- **Sguardo su tutto lo schermo**: il backend Rust emette la posizione globale del cursore circa 30 volte al secondo, **solo mentre l'isola è visibile**, e il frontend la converte in `setLookTarget`. Così Wisp mi guarda anche quando il mouse è lontano dall'isola. Valuta tu il modo più leggero di farlo in Tauri 2 e dimmelo.
- **Trascinamento nell'isola**: non può uscire dalla finestra. Diventa un **elastico**: lo posso tirare giù fino a circa 40 px con resistenza crescente, e al rilascio torna su rimbalzando.
- **Clic** e **carezza** funzionano come nel riferimento, sia con l'isola chiusa (Wisp a circa 72 px) sia aperta (circa 150 px).
- In modalità `free` (la pagina playground sotto) il trascinamento è libero come nel riferimento.

## Pagina playground (solo sviluppo)

Una pagina `playground.html` servita solo in sviluppo, simile al riferimento: Wisp grande in modalità `free`, pulsanti per i sei stati e le tre palette, e i cursori dei parametri principali (rigidità e smorzamento delle molle principali, intensità della rotazione) per ritoccarli dal vivo. Mi serve per calibrare il personaggio senza aprire l'app.

## Test

Con Vitest:
- `spring`: converge all'obiettivo senza esplodere con `dt` da 1 a 33 ms
- `geometry`: per tutti gli stati e valori estremi dei parametri i path non contengono `NaN` né `Infinity`
- `sim`: dopo 2 s di simulazione in ogni stato, i parametri sono vicini agli obiettivi di quello stato
- il loop si ferma con la finestra nascosta

## Come voglio lavorare

1. Leggi questo file e `docs/wisp-reference.html`, guarda il personaggio attuale nel codice, e mostrami un **piano breve** (file, API, come porti cursore globale ed elastico). Aspetta il mio ok.
2. Passi piccoli, ognuno con un commit:
   1. `spring`, `params`, `geometry` con i test
   2. `sim` + `render` nella pagina playground: deve comportarsi come il riferimento
   3. `input`: clic, trascinamento, carezza, idle
   4. integrazione nell'isola: stato dal backend, sguardo globale, elastico
   5. rimozione del vecchio personaggio
3. Dopo ogni passo dimmi cosa provare a mano.
4. Aggiorna `CLAUDE.md` e la sezione del personaggio nel documento principale del progetto con la nuova architettura.

## Fatto quando

- [ ] Nella playground Wisp si comporta come in `wisp-reference.html`
- [ ] Nell'isola mi segue con lo sguardo anche quando il mouse è lontano
- [ ] Clic, rimbalzo, elastico e carezza funzionano nell'isola chiusa e aperta
- [ ] I cambi di stato dal backend sono fluidi, senza scatti
- [ ] Con `prefers-reduced-motion` attivo resta fermo ma cambia comunque espressione
- [ ] Con l'isola nascosta l'uso della CPU è praticamente zero
- [ ] I test passano
