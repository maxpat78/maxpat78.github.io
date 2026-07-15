// ui/TableRenderer.js
//
// Livello di presentazione. Non conosce le regole del gioco: sa solo come
// disegnare/animare carte generiche a partire dagli eventi emessi da
// TrickTakingEngine, e come tradurre un click dell'utente in una chiamata a
// engine.playCard(...). Riusabile per un altro gioco a prese cambiando solo
// la configurazione (layout, path immagini) passata al costruttore.
//
// Scelte di choreografia (vedi commenti puntuali piu' sotto):
//  - la presa e' in DUE fasi, come nella realta': prima la seconda carta
//    raggiunge la prima sul tavolo (si "posano" vicine), POI entrambe insieme
//    volano verso chi le ha prese;
//  - la pescata NON e' simultanea alla presa: parte solo a tavolo sgombro;
//  - quando l'avversario (IA) pesca una carta, questa viene mostrata
//    brevemente a video (regola: la pescata e' pubblica nel gioco a due) e
//    poi ricoperta, restando "in mano" come dorso, agganciato al proprio slot
//    cosi' che la mano dell'IA si assottigli visivamente quando gioca;
//  - la mano dell'umano puo' essere riordinata per seme/valore (opts.sortHand,
//    default true) e, se serve, resa scorrevole orizzontalmente
//    (opts.handScroll). Questa logica di disposizione e' delegata a
//    HandLayout (nessuna dipendenza da jQuery, vedi ui/HandLayout.js):
//    qui ci limitiamo a leggerne l'output e ad animare le carte di conseguenza.

import { HandLayout } from './HandLayout.js'

export class TableRenderer {
    /**
     * @param {TrickTakingEngine} engine
     * @param {object} opts
     *   humanIndex, aiIndex: indici dei due giocatori nell'array engine.players
     *   imagePath(cardId): string -> url dell'immagine della carta
     *   backImagePath: string -> url del dorso
     *   coord: { [playerIndex]: {x,y}, table: {x,y} }
     *   formatInfo(engine): string per il pannello info (puo' contenere '\n')
     *   onRoundOver(result): callback per l'orchestrazione a livello di app
     *   sortHand: bool, ordina la mano dell'umano per seme/valore (default true)
     *   handSpacing: distanza in px fra una carta e la successiva in mano (default 90)
     *   handScroll: { maxWidth } opzionale, attiva lo scorrimento orizzontale
     *               della mano umana quando supera maxWidth px
     */
    constructor(engine, opts) {
        this.engine = engine
        this.opts = opts
        this.attesa = false

        // durate di riferimento delle animazioni, usate per sequenziare
        // correttamente presa -> pescata -> turno successivo
        this.TABLE_SETTLE_MS = 500    // tempo perche' la seconda carta finisca di "posarsi" accanto alla prima
        this.FLY_TO_WINNER_MS = 500   // tempo del volo (insieme) verso chi ha preso
        this.FADE_MS = 500            // capovolgimento + dissolvenza finale
        this.RESOLVE_ANIM_MS = this.TABLE_SETTLE_MS + this.FLY_TO_WINNER_MS + this.FADE_MS
        this.REDRAW_ANIM_MS = 2300    // tragitto pescata + mostra/ricopri (vedi _flipReveal)

        this._aiHandBack = {}   // { slot: backElementId } - dorsi attualmente "in mano" all'IA
        this._revealToken = {}  // { "playerIndex:slot": token } - vedi nota in _bindEngineEvents
        this._willRedraw = false
        this._drawCounter = 0
        this._backCounter = this._totalDeckSize() // vedi _currentBackId

        this.handLayout = new HandLayout({
            rules: engine.rules,
            sorted: opts.sortHand !== false,
            spacing: opts.handSpacing || 90,
            // con lo scorrimento attivo le carte sono figlie di #hand-scroll, un
            // contenitore gia' posizionato a coord.x/coord.y: le coordinate interne
            // vanno quindi calcolate a partire da 0, non ripetendo l'offset di pagina
            x: opts.handScroll ? 0 : opts.coord[opts.humanIndex].x,
            y: opts.handScroll ? 0 : opts.coord[opts.humanIndex].y,
        })

        this._bindEngineEvents()
    }

    _bindEngineEvents() {
        this.engine.on('deal', ({ playerIndex, slot, card }) => {
            const backId = this._currentBackId()
            this._animateDeal(playerIndex, slot, card, false, backId)
        })

        this.engine.on('cardPlayed', ({ playerIndex, card, slot }) => this._animatePlay(playerIndex, card, slot))

        this.engine.on('trickResolved', (payload) => {
            // il mazzo, a questo punto, riflette ancora lo stato PRIMA di un'eventuale
            // ripescata per questa presa: e' il momento giusto per sapere se seguira' o no
            this._willRedraw = this.engine.rules.drawAfterTrick() && !this.engine.deck.isEmpty()
            this._drawCounter = 0
            this._animateResolve(payload)
        })

        this.engine.on('draw', ({ playerIndex, slot, card }) => {
            const backId = this._currentBackId()
            const stagger = this._drawCounter++ * 200
            const key = this._key(playerIndex, slot)
            // il token va creato SUBITO (sincrono, a evento appena ricevuto): se lo
            // creassimo solo quando l'animazione (gia' ritardata) parte davvero, una
            // rigiocata fulminea dello stesso slot potrebbe avvenire in quella finestra
            // e non verrebbe mai rilevata come "non piu' valida"
            const token = Symbol('reveal')
            this._revealToken[key] = token
            // la pescata parte solo dopo che l'animazione di presa e' visivamente conclusa
            setTimeout(() => {
                if (this._revealToken[key] !== token) return // rigiocato prima ancora che l'animazione iniziasse
                this._animateDeal(playerIndex, slot, card, true, backId, token)
            }, this.RESOLVE_ANIM_MS + stagger)
        })

        this.engine.on('turnChanged', ({ turnIndex }) => this._onTurnChanged(turnIndex))
        this.engine.on('roundOver', (result) => this._onRoundOver(result))
    }

    _key(playerIndex, slot) { return `${playerIndex}:${slot}` }

    _totalDeckSize() {
        const cfg = this.engine.rules.deckConfig()
        return cfg.suits.length * cfg.ranks.length
    }

    // id del dorso "fisico" da animare per la carta appena rimossa dal mazzo.
    // Un contatore interno, decrementato una volta per ogni carta tolta dal
    // mazzo (sia in fase di mazzata iniziale sia di pescata), garantisce un id
    // sempre univoco. NON va derivato da deck.count(): quando restano le ultime
    // due carte, la prima pescata porta il conteggio a 1 e la seconda a 0, e un
    // fallback tipo Math.max(conteggio,1) le farebbe collidere sullo stesso
    // sprite fisico (bug osservato: solo una delle due pescate finali si vedeva
    // animata, l'altra "rubava" la stessa immagine gia' arrivata altrove).
    _currentBackId() {
        return `Dorso${this._backCounter--}`
    }

    // unico punto che decide quando far giocare l'IA
    _onTurnChanged(turnIndex) {
        if (turnIndex !== this.opts.aiIndex) return
        if (this.engine.isRoundOver()) return // ultima presa vinta senza ripescata: la smazzata e' gia' finita
        const midTrick = this.engine.trick.length > 0
        let delay
        if (midTrick) delay = 700
        else delay = this._willRedraw ? this.RESOLVE_ANIM_MS + this.REDRAW_ANIM_MS : this.RESOLVE_ANIM_MS
        setTimeout(() => this.playAiTurn(), delay)
    }

    // precarica le immagini di tutte le carte del mazzo corrente + i dorsi
    preload(onReady) {
        const cfg = this.engine.rules.deckConfig()
        const ids = []
        for (const s of cfg.suits) for (const r of cfg.ranks) ids.push(`${r}${s}`)
        let loaded = 0
        const total = ids.length
        for (const id of ids) {
            $(`<img src="${this.opts.imagePath(id)}" id="${id}" class="fronte" width="150px" height="277px" style="position:absolute">`)
                .on('load', () => { if (++loaded >= total) onReady() })
                .hide()
                .appendTo('#game-board')
        }
        // uno sprite dorso distinto per OGNI carta del mazzo: nessun riuso,
        // altrimenti due pescate ravvicinate (tipico delle ultime due carte)
        // potrebbero contendersi lo stesso sprite fisico (vedi _currentBackId)
        for (let i = 1; i <= cfg.suits.length * cfg.ranks.length; i++) {
            $(`<img src="${this.opts.backImagePath}" id="Dorso${i}" class="dorso" width="150px" height="277px" style="position:absolute">`)
                .hide()
                .appendTo('#game-board')
        }
        $('#game-board').append('<div id="info" style="position:absolute;color:white;background-color:transparent;font-weight:bold;width:fit-content;font-family:Arial;font-size:95%;line-height:1.25;white-space:pre-line;z-index:100"/>')

        // link "Aiuto" opzionale, sotto il pannello punteggio: attiva la
        // finestra di regole solo a richiesta invece di mostrarla sempre
        // all'avvio. Ogni app (Tressette, Briscola, ...) passa il proprio
        // callback in opts.onHelp; se assente, il link non viene creato.
        if (this.opts.onHelp) {
            const c = this.opts.coord.info
            $(`<a href="#" id="help-link">Aiuto</a>`)
                .css({
                    position: 'absolute', left: c.left, top: c.top + 40,
                    color: 'white', fontFamily: 'Arial', fontSize: '85%',
                    textDecoration: 'underline', cursor: 'pointer', zIndex: 100,
                })
                .on('click', (e) => { e.preventDefault(); this.opts.onHelp() })
                .appendTo('#game-board')
        }

        // contenitore opzionale a scorrimento orizzontale per la mano dell'umano
        if (this.opts.handScroll) {
            const c = this.opts.coord[this.opts.humanIndex]
            $('#game-board').append(
                `<div id="hand-scroll" style="position:absolute;left:${c.x}px;top:${c.y}px;` +
                `width:${this.opts.handScroll.maxWidth}px;height:290px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;"/>`
            )
        }

        this.updateInfo(this.opts.formatInfo(this.engine))
    }

    drawDeckStack() {
        const baseX = 10, baseY = 293 // origine "nominale" della pila, usata anche per la briscola sotto
        let x = baseX, y = baseY, z = -100
        $('img[class="dorso"]').each(function () {
            $(this).css({ left: x, top: y, zIndex: z }).show()
            x -= 0.1; y -= 0.1; z += 1
        })
        // supporto opzionale: alcuni giochi (es. Briscola) tagliano una carta a
        // inizio smazzata e la lasciano scoperta, di traverso, sotto il mazzo,
        // come ultima carta da pescare. Se il RuleSet la espone (rules.trumpCard),
        // la mostriamo qui; per gli altri giochi (es. Tressette) e' assente e
        // questo blocco non fa nulla.
        //
        // La carta (150x277) ruota di 90 gradi attorno al proprio centro: per
        // farla sporgere verso destra (il centro tavolo) da sotto il mazzo,
        // portiamo il centro sul bordo destro della pila (baseX + 150 di
        // larghezza carta / 2 di larghezza gia' ruotata... piu' semplicemente:
        // il centro ruotato resta lo stesso centro non ruotato, quindi basta
        // spostare il centro sul bordo destro della pila) e lasciamo la Y al
        // centro verticale della pila stessa.
        const trumpCard = this.engine.rules.trumpCard
        if (trumpCard) {
            const cardW = 150, cardH = 277
            const centerX = baseX + cardW      // bordo destro della pila: meta' carta resta coperta dal mazzo, meta' sporge verso il tavolo
            const centerY = baseY + cardH / 2  // centro verticale della pila
            $(`#${trumpCard.id}`).show().css({
                left: centerX - cardW / 2, top: centerY - cardH / 2, zIndex: -200,
                transform: 'rotate(90deg)', transformOrigin: 'center center',
            })
        }
    }

    updateInfo(text) {
        $('#info').css(this.opts.coord.info).text(text)
    }

    // --- disposizione della mano dell'umano (ordinata e, se attivo, scorrevole) ---

    // ricalcola e anima la posizione di tutte le carte visibili in mano
    // all'umano, secondo l'ordine deciso da HandLayout (vedi ui/HandLayout.js).
    // Lo z-index viene ricalcolato qui in base alla posizione VISIVA (sinistra
    // -> destra), non allo slot "grezzo" di pescata: e' questo che mantiene
    // corretto il ventaglio a domino (ogni carta copre solo una fetta di quella
    // alla sua sinistra, mai il contrario) anche quando l'ordinamento cambia
    // l'ordine di pescata originale.
    //
    // IMPORTANTE: ogni carta riceve .stop(true, false) prima del nuovo
    // .animate(): per default jQuery ACCODA le animazioni sullo stesso
    // elemento invece di sostituirle, quindi senza questo stop() una
    // ridistribuzione rapida (es. durante la mazzata iniziale, chiamata una
    // volta per ogni carta che arriva) si accumula in una coda di animazioni
    // superate, causando ritardi a cascata e piccoli scostamenti verticali
    // dovuti a passaggi intermedi ormai obsoleti che continuano comunque ad
    // essere eseguiti in sequenza.
    _layoutHumanHand({ animate = true } = {}) {
        const hand = this.engine.players[this.opts.humanIndex].hand
        const entries = this.handLayout.layout(hand)
        const scrollable = !!this.opts.handScroll

        entries.forEach(({ card, left, top }, i) => {
            const el = $(`#${card.id}`)
            if (scrollable) {
                // dentro il contenitore a scorrimento le coordinate sono relative
                // al contenitore stesso, non alla pagina: usiamo left/top "locali"
                // (handLayout e' configurato con x=0 in questo caso, vedi costruttore)
                if (el.parent().attr('id') !== 'hand-scroll') el.appendTo('#hand-scroll')
            }
            el.css('zIndex', i) // sempre ricalcolato: mai lasciato allo slot di pescata
            if (animate) el.stop(true, false).animate({ left, top }, 300)
            else el.stop(true, false).css({ left, top })
        })

        if (scrollable) {
            $('#hand-scroll').css('min-width', this.handLayout.widthFor(entries.length))
        }
    }

    // isRedraw=false -> mazzata iniziale; isRedraw=true -> pescata dopo una presa.
    // `token`, se presente, e' il token creato al momento dell'evento 'draw':
    // se non coincide piu' con quello registrato per questo slot, la carta e'
    // gia' stata rigiocata nel frattempo e l'intera animazione va abortita.
    _animateDeal(playerIndex, slot, card, isRedraw, backId, token) {
        const isHuman = playerIndex === this.opts.humanIndex
        const key = this._key(playerIndex, slot)
        const isStale = () => isRedraw && this._revealToken[key] !== token
        if (isStale()) return // rigiocato prima ancora che il tragitto dal tallone iniziasse

        // difensivo: se questa carta aveva gia' un'immagine visibile a schermo
        // per qualche motivo (es. la carta di briscola esposta sotto il mazzo
        // in Briscola: vedi BriscolaRules.trumpCard e drawDeckStack), la
        // nascondiamo ora che sta per essere presa in mano
        $(`#${card.id}`).hide()

        const tempo = isRedraw ? (isHuman ? 900 : 500) : 700 - (playerIndex === this.opts.aiIndex ? 100 : 0)
        // per l'umano il vero "posto" dipende dall'ordinamento della mano (se attivo):
        // usiamo comunque una destinazione "grezza" per il tragitto dal tallone,
        // e sara' _layoutHumanHand a rimettere in ordine subito dopo la rivelazione
        const dest = isHuman
            ? { left: this.opts.coord[playerIndex].x + slot * (this.opts.handSpacing || 90), top: this.opts.coord[playerIndex].y }
            : { left: this.opts.coord[playerIndex].x + slot * 90, top: this.opts.coord[playerIndex].y }

        $(`#${backId}`).show().css({ zIndex: slot }).stop(true, false)
            .animate(dest, tempo, () => {
                if (isStale()) return // rigiocato durante il tragitto

                if (isHuman) {
                    this._flipReveal(backId, card, dest, slot, {
                        keepFaceUp: true,
                        isStale,
                        onFlipped: () => {
                            $(`#${card.id}`).off('click').on('click', () => this._onHumanCardClick(playerIndex, slot))
                            this._layoutHumanHand() // riordina subito la mano includendo la nuova carta
                        },
                    })
                } else if (isRedraw && this.engine.rules.revealsDrawnCards?.()) {
                    // regola: in alcuni giochi (es. Tressette) la carta pescata dal
                    // tallone viene mostrata anche all'avversario, poi torna
                    // coperta e resta "in mano" all'IA
                    this._flipReveal(backId, card, dest, slot, {
                        keepFaceUp: false,
                        holdMs: 900,
                        isStale,
                        onCovered: () => { this._aiHandBack[slot] = backId },
                    })
                } else {
                    // pescata privata (es. Briscola) o mazzata iniziale: resta
                    // sempre coperta, non viene mai mostrata
                    this._aiHandBack[slot] = backId
                }
            })
    }

    // Coreografia del "giro carta": nasconde il dorso, mostra la faccia al suo posto.
    // Se keepFaceUp e' false, dopo holdMs la ricopre di nuovo (dorso al posto della faccia).
    // isStale() interrompe la coreografia (senza toccare piu' nulla) se lo slot e'
    // stato rigiocato nel frattempo, ad ogni fase intermedia.
    _flipReveal(backId, card, dest, slot, { keepFaceUp, holdMs = 500, onFlipped, onCovered, isStale = () => false }) {
        $(`#${backId}`).css({ transition: '0.5s', transform: 'rotateY(90deg)', transformOrigin: '33% 50%', transformStyle: 'preserve-3d' })
        setTimeout(() => {
            if (isStale()) return
            $(`#${backId}`).hide().css({ transition: '', transform: '' })
            $(`#${card.id}`).show().css({ left: dest.left, top: dest.top, zIndex: slot, transition: '', transform: '' })
            if (onFlipped) onFlipped()
            if (keepFaceUp) return

            setTimeout(() => {
                if (isStale()) return
                $(`#${card.id}`).css({ transition: '0.5s', transform: 'rotateY(90deg)', transformOrigin: '33% 50%', transformStyle: 'preserve-3d' })
                setTimeout(() => {
                    if (isStale()) return
                    $(`#${card.id}`).hide().css({ transition: '', transform: '' })
                    $(`#${backId}`).show().css({ left: dest.left, top: dest.top, zIndex: slot, transition: '', transform: '' })
                    if (onCovered) onCovered()
                }, 500)
            }, holdMs)
        }, 500)
    }

    _onHumanCardClick(playerIndex, slot) {
        if (this.attesa) return
        const result = this.engine.playCard(playerIndex, slot)
        if (!result.ok) this._showDialog('Errore', result.reason)
    }

    // fa giocare la IA quando e' il suo turno (invocato da _onTurnChanged)
    playAiTurn() {
        const ai = this.engine.players[this.opts.aiIndex]
        if (ai.isHuman || ai.isHandEmpty()) return
        const view = this.engine.buildView(this.opts.aiIndex)
        const slot = ai.chooseCardIndex(view)
        this.engine.playCard(this.opts.aiIndex, slot)
    }

    _animatePlay(playerIndex, card, slot) {
        const isHuman = playerIndex === this.opts.humanIndex
        if (isHuman) this.attesa = true

        // invalidiamo SUBITO un eventuale token di pescata ancora in corso su
        // questo slot: protegge da una race condition (vedi _bindEngineEvents)
        delete this._revealToken[this._key(playerIndex, slot)]

        // se gioca l'IA, il dorso che rappresentava quella carta in mano deve
        // sparire ORA: e' cosi' che si "vede" la mano dell'IA assottigliarsi
        if (playerIndex === this.opts.aiIndex) {
            const backId = this._aiHandBack[slot]
            if (backId) { $(`#${backId}`).hide(); delete this._aiHandBack[slot] }
        }

        const card$ = $(`#${card.id}`)
        // annulla SEMPRE qualunque animazione ancora in coda (es. un riordino
        // del ventaglio non ancora concluso): senza questo stop(), jQuery
        // accoderebbe il volo verso il tavolo DIETRO le animazioni pendenti,
        // facendolo partire in ritardo e da una posizione ormai superata —
        // esattamente il bug segnalato ("la carta resta ferma, poi parte da
        // un'altra posizione"). Con jumpToEnd=false la carta resta esattamente
        // dov'e' visivamente ORA: e' da li' che partira' verso il tavolo.
        card$.stop(true, false)

        if (isHuman) {
            if (this.opts.handScroll) {
                // la carta esce dal contenitore a scorrimento: ne fissiamo la
                // posizione assoluta di pagina PRIMA di staccarla, cosi' il volo
                // verso il tavolo (in coordinate di pagina) parte dal punto
                // visivamente corretto
                const pageOffset = card$.offset()
                card$.appendTo('#game-board').css({ left: pageOffset.left, top: pageOffset.top })
            }
            // altrimenti nessuna posizione "from" da impostare: dopo lo stop()
            // la carta e' gia' esattamente dove si vede, e l'animazione verso
            // il tavolo partira' naturalmente da li'
        } else {
            // le carte dell'IA restano coperte finche' non vengono giocate: se
            // provengono dalla mazzata iniziale (mai pescate/rivelate dopo), la
            // loro immagine "faccia in su" non ha mai avuto una posizione
            // valida assegnata, quindi va sempre impostata esplicitamente
            card$.css({ left: this.opts.coord[playerIndex].x + slot * 90, top: this.opts.coord[playerIndex].y })
        }

        card$.css({ transition: '', transform: '' })

        const isSecond = this.engine.trick.length >= 1 // dopo il push, quindi se >=1 e' la 2a carta calata
        const d = isSecond ? 90 : 0
        card$.show().css({ zIndex: d + 3 })
            .animate({ left: this.opts.coord.table.x + d, top: this.opts.coord.table.y }, 500)

        if (isHuman) this._layoutHumanHand() // richiude il ventaglio sulle carte rimaste
    }

    // Presa in due fasi, come nella realta':
    //  1) le due carte si "posano" sul tavolo (gia' avvenuto con _animatePlay:
    //     qui aspettiamo solo che quel tragitto sia visivamente concluso)
    //  2) SOLO DOPO, insieme, volano verso chi le ha prese
    _animateResolve({ trick, winnerIndex }) {
        const winnerCoord = this.opts.coord[winnerIndex]
        const x = winnerCoord.x - 100, y = winnerCoord.y + (winnerIndex === 0 ? -100 : 100)

        setTimeout(() => {
            const fadeMs = this.FADE_MS
            trick.forEach(({ card }) => {
                $(`#${card.id}`)
                    .stop(true, false)
                    .animate({ left: x, top: y }, this.FLY_TO_WINNER_MS, function () {
                        $(this).css({ transition: `${fadeMs / 1000}s all ease-out`, transform: 'rotateY(90deg)', transformOrigin: '33% 50%', transformStyle: 'preserve-3d' })
                            .fadeOut(fadeMs)
                    })
            })
        }, this.TABLE_SETTLE_MS)

        setTimeout(() => {
            this.attesa = false
            this.updateInfo(this.opts.formatInfo(this.engine))
        }, this.RESOLVE_ANIM_MS)
    }

    _showDialog(title, text, onClose) {
        $(`<div title="${title}"/>`).text(text).dialog({
            modal: true,
            buttons: { Ok: function () { $(this).dialog('close'); if (onClose) onClose() } },
        })
    }

    _onRoundOver(result) {
        if (this.opts.onRoundOver) this.opts.onRoundOver(result)
    }

    // ripulisce il tavolo e ridisegna per una nuova smazzata
    reset() {
        this._aiHandBack = {}
        this._revealToken = {}
        this._backCounter = this._totalDeckSize()
        $('img').each(function () {
            $(this).hide().off('click').css({ transition: '', transform: '', transformOrigin: '', transformStyle: '', zIndex: 0 })
        })
        if (this.opts.handScroll) $('#hand-scroll').children().appendTo('#game-board')
        this.drawDeckStack()
    }

    showMessage(title, text, onClose) { this._showDialog(title, text, onClose) }
}
