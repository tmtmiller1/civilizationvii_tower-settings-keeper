# Tower Settings Keeper

Una mod per Civilization VII. Con la mod installata, le opzioni che imposti nelle altre mod restano impostate dopo un riavvio del gioco. Non ha opzioni proprie e non cambia nulla nella partita.

## Il problema

Le mod conservano le loro impostazioni nel `localStorage` del gioco. In Civilization VII 1.5.0 quell'archivio ha un difetto. Una lettura restituisce la prima voce dell'archivio, qualunque voce sia stata richiesta, e non c'è modo di elencare le voci. Una mod può rileggere le proprie impostazioni solo se la sua voce si trova per caso al primo posto. Ogni altra mod riceve i dati di un'altra mod, li tratta come propri e li riscrive con il proprio nome al salvataggio successivo.

I giocatori vedono pannelli delle opzioni che si azzerano tra un avvio e l'altro, e a volte le impostazioni di una mod compaiono dentro un'altra.

La maggior parte dei pannelli delle opzioni condivide una voce chiamata `modSettings`, con una sezione per mod. Circa cinquanta mod del Workshop includono inoltre una routine che cancella l'intero archivio appena vede una seconda voce. Basta una mod che salvi le sue impostazioni in una voce propria per cancellare le impostazioni di tutte le altre al salvataggio successivo.

## Cosa fa la mod

Tiene ogni voce dentro l'unica riga che il gioco riesce a leggere e risponde a ogni chiamata a `localStorage` da quella riga.

- Una mod che usa una chiave propria la trova salvata e riletta con quella chiave.
- La voce condivisa `modSettings` funziona come prima, una sezione per mod, quindi i pannelli delle opzioni esistenti non hanno bisogno di modifiche.
- L'archivio dichiara sempre una sola voce, quindi la routine di cancellazione non parte mai.
- Se un'altra mod ha già messo l'archivio in disordine, la mod rimette al loro posto le voci che riesce a identificare e lascia il resto com'è. Ricontrolla a ogni avvio.

Le altre mod non hanno bisogno di aggiornamenti. Funziona con le mod già presenti nel Workshop.

## Funziona con tutte le mod, senza modifiche

Questa mod risolve il problema per tutte le mod che salvano impostazioni, così come sono oggi. Gli autori delle mod non devono cambiare nulla né registrare nulla. Un giocatore che installa questa mod ottiene in un colpo solo impostazioni funzionanti in tutte le sue mod.

Gli autori delle mod hanno una possibilità in più. Possono includere lo stesso file nella propria mod, così i loro giocatori sono coperti anche se non installano mai questa mod. È descritto più avanti in «Per gli autori di mod». Una mod che include il file e questa mod possono essere installate insieme. Ne gira una sola copia, la più recente, e le altre non fanno nulla.

## Schermate

Opzioni cambiate nel menu principale e rilette nella schermata delle opzioni dopo un riavvio:

| Prima | Dopo la modifica | Dopo un riavvio |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Opzioni cambiate durante una partita e rilette dopo un altro riavvio, nel menu e in partita:

| In partita, prima | In partita, dopo | Menu, dopo un riavvio | Partita, dopo un riavvio |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Le altre mod usano i valori salvati, non si limitano a mostrarli. L'opzione «Commander lens activation» di Map Trix è stata impostata su «Military and Recon Units» e salvata. In un nuovo processo, selezionare un esploratore attiva la sua lente del comandante, cosa che non avviene con l'impostazione predefinita:

![](../images/lens-persisted-scout.png)

Provata sulla 1.5.0 con 28 mod, tra cui Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, un gestore di impostazioni e AutoMissionary. Il resoconto completo è in [docs/design.md](../design.md) (in inglese).

## Installazione

Iscriviti nello Steam Workshop, oppure scarica lo zip dell'ultima versione e scompattalo in `~/Library/Application Support/Civilization VII/Mods/` (macOS) o `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Poi attivala in «Contenuti aggiuntivi». Non c'è nulla da configurare.

## Cose da sapere

- Le impostazioni che salvi da ora in poi restano. Quelle perse prima di installare la mod sono perse, a meno che non siano ancora su disco in una voce che la mod riesce a identificare.
- Se l'archivio era già danneggiato, la mod non tira a indovinare quale mod abbia scritto una voce che non riesce a identificare. Se quella voce è l'unica rimasta, la mod ricostruisce l'archivio intorno a essa e ne conserva il contenuto. Il nome della voce va perso. Una versione successiva che riconosce il contenuto lo rimette sotto il nome giusto. Se ci sono due o più voci del genere davanti, la mod crea una nuova radice davanti a loro, le lascia su disco e riprova all'avvio successivo. Non sovrascrive mai i dati di un'altra mod.
- Il gioco non garantisce l'ordine in cui girano gli script delle mod. Una mod che legge le sue impostazioni nel momento in cui il suo script viene caricato, prima che questa mod sia partita, vede il vecchio comportamento per quel solo avvio. In tutti gli avvii di prova finora questa mod è partita per prima.
- I testi della mod sono tradotti in tutte le undici lingue supportate dal gioco.
- L'archivio ha un limite di 4 MB. Sono otto volte i 0,5 MB che occupa un archivio con 28 mod. Una mod che prova a superarlo vede rifiutata quella sola scrittura e conserva le impostazioni precedenti, e in Opzioni, Componenti aggiuntivi compare una riga "Limite di archiviazione raggiunto" che nomina la mod. Nient'altro è interessato. Vedi "Carico e limiti" più avanti.
- Sullo schermo non compare nulla, a parte una riga in `Logs/UI.log` che inizia con `[settings-keeper] ready:`. L'eccezione è il caso di riserva descritto sopra. Allora «Opzioni, Componenti aggiuntivi» mostra una riga «Ricostruisci l'archivio». Premila, conferma, e le voci che la mod non è riuscita a identificare vengono eliminate e l'archivio viene riscritto come un'unica voce. La riga sparisce quando l'archivio torna normale.

  | La riga, solo quando serve | La conferma |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Carico e limiti

Tutto sta in una sola riga, quindi la dimensione di quella riga è ciò che conta. Con 28 mod installate la riga sulla macchina di prova è di circa 0,5 MB, quasi tutto lo storico delle partite di una sola mod. Un pannello opzioni aggiunge qualche centinaio di byte. Una scrittura serializza l'intera riga, circa 8 ms a quella dimensione, una volta per attività indipendentemente da quanti valori vi si scrivano. Il numero di mod da solo non conta. Conta quanto memorizzano.

Per trovare dove il motore si arrende, una sonda ha fatto crescere la riga di 1 MB per passo attraverso la mod in una partita Gioca ora con le stesse 28 mod, e avvii separati hanno provato i singoli pezzi da soli.

| Dimensione della riga | Una scrittura (serializzare e salvare) | Lettura di una chiave dopo una scrittura |
|---|---|---|
| 0,5 MB, l'archivio reale | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 MB in una sola scrittura | 102 ms | |
| 20 MB, cresciuto 1 MB alla volta | 197 ms | |

Niente è andato perso o si è corrotto a nessuna dimensione, e l'archivio è rimasto una sola riga. Il processo del gioco, invece, ha un tetto. Si è fermato, senza rapporto di crash, al passo da 14 MB quando la riga veniva letta e riscritta più volte di seguito, e al passo da 21 MB quando veniva solo riscritta. Un archivio da 14 MB si è caricato nel menu principale e in partita con tutte le chiavi leggibili, e si è fermato quando la riga è stata riletta e riscritta un'altra volta. Il processo era a 1,9 GB quando si è fermato, quindi il tetto è la memoria del gioco, non l'archiviazione.

La mod rifiuta quindi ogni scrittura che porterebbe la riga oltre i 4 MB, un quarto della dimensione più bassa a cui il gioco si è fermato. La scrittura rifiutata lancia lo stesso `QuotaExceededError` che un browser lancia quando il suo localStorage è pieno, quindi una mod scritta per l'API web sa già cosa significa. Il valore precedente della mod resta, tutte le altre mod non vengono toccate, il registro nomina la mod e le dimensioni, e Opzioni, Componenti aggiuntivi mostra una riga "Limite di archiviazione raggiunto" con gli stessi dettagli e un OK che la rimuove. Il limite è una costante in cima a `ui/settings-keeper.js`.

## Rimuovere la mod

Di solito non c'è nulla da fare. L'archivio è una sola riga, quindi il gioco legge per primo `modSettings` come prima, e le altre mod trovano le loro sezioni. L'unica aggiunta sono alcuni campi interni che ignorano. Se «Opzioni» mostra la riga «Ricostruisci l'archivio», premila prima di disattivare la mod. Altrimenti la routine di cancellazione delle altre mod svuoterà l'archivio al salvataggio successivo.

## Per gli autori di mod

Non ti viene chiesto nulla. Le impostazioni della tua mod funzionano con questa mod installata, sia che la tua mod usi la voce condivisa `modSettings`, sia che usi una chiave propria.

Se vuoi che i tuoi giocatori siano coperti senza installare questa mod, puoi includere la correzione nella tua mod. È un file e due righe nel tuo modinfo, e il tuo codice delle impostazioni resta com'è. Le istruzioni sono in [embed/README.md](../../embed/README.md) (in inglese), oppure prendi `settings-keeper-embed-<versione>.zip` dall'ultima versione.

## Licenza

MIT.
