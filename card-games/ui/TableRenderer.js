// Livello di presentazione. Non conosce le regole del gioco: sa solo come
// disegnare/animare carte generiche a partire dagli eventi emessi da
// TrickTakingEngine, e come tradurre un click dell'utente in una chiamata a
// engine.playCard(...). Riusabile per un altro gioco a prese cambiando solo
// la configurazione (coord.pile, coord.info, path immagini) passata al
// costruttore.
//
// Layout: stesso linguaggio grafico di ScopaRenderer (tavolo verticale
// 720x1280, mazzo "a scomparsa" che scivola dentro/fuori vista durante la
// distribuzione, tre fasce orizzontali di dimensioni decrescenti dall'alto
// in basso: ventaglio IA (piccolo, dorsi coperti) - tavolo di presa (medio)
// - mano umana (grande, in basso).
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
//    qui ci limitiamo a leggerne l'ordine e ad animare le carte di conseguenza.

import { HandLayout } from './HandLayout.js'
import { responsiveDialogWidth } from './dialogUtils.js'

// --- geometria condivisa del tavolo verticale (stessa "grammatica" di ScopaRenderer) ---
const BOARD_W = 720
const BOARD_H = 1280

// fascia alta: ventaglio coperto dell'IA, carte piccole
const AI_CARD_W = 80, AI_CARD_H = 148
const AI_Y = 100
const AI_SPACING = 50

// fascia centrale: carte calate in presa. Dimensione grande (vicina a quella
// della mano). Ad ogni presa la coppia di carte atterra in un punto DIVERSO
// ma sempre plausibile (leggero spostamento reciproco, rotazione, a volte
// quasi sovrapposte, a volte quasi affiancate) — vedi _randomTrickLayout().
// TABLE_ZONE_* delimita il rettangolo entro cui puo' cadere l'ANGOLO in alto
// a sinistra di ciascuna carta: e' tarato per restare sempre entro lo spazio
// libero del tavolo, qualunque sia lo scarto/rotazione applicato:
//  - a destra il mazzo (fermo a DECK_VISIBLE_X..+DECK_CARD_W) e a sinistra i
//    badge dei punti (fermi a AI_BADGE_X/HUMAN_BADGE_X) delimitano i lati
//    orizzontali, con margine sufficiente perche' anche lo scarto fra le due
//    carte non li raggiunga mai;
//  - sopra il ventaglio IA e sotto la mano umana delimitano i lati verticali.
const TABLE_CARD_W = 150, TABLE_CARD_H = 277
const TABLE_ZONE_X_MIN = 160, TABLE_ZONE_X_MAX = 460
const TABLE_ZONE_Y_MIN = 270, TABLE_ZONE_Y_MAX = 600
const TABLE_PAIR_OFFSET_X = 55, TABLE_PAIR_OFFSET_Y = 45 // scarto "medio" fra le due carte di una presa
const TABLE_JITTER = 36 // variazione casuale in piu'/meno, per non farle atterrare sempre uguali
const TABLE_ROTATE_MAX_DEG = 9 // rotazione casuale massima (in entrambi i versi) di ciascuna carta

// fascia bassa: mano dell'umano, carte grandi
const HAND_CARD_W = 180, HAND_CARD_H = 332
const HAND_Y = 900
const HAND_MAX_SPACING = 120
const HAND_MAX_WIDTH = 680 // margine di sicurezza per non uscire dai 720px del tavolo

// ventaglio IA: base per lo z-index, cosi' l'ordine di sovrapposizione segue
// sempre lo slot (carta piu' a destra sopra), invece di dipendere dall'ordine
// im cui gli <img> sono stati creati nel DOM (che e' quello dei dorsi, non
// quello degli slot in mano)
const AI_Z_BASE = 50

// mazzo: NON e' piu' "a scomparsa" come in ScopaRenderer. Qui si pesca una
// carta alla volta per tutta la durata della smazzata (non solo all'inizio),
// quindi scorre in vista UNA VOLTA SOLA (alla prima carta distribuita) e vi
// resta ferma fino a esaurimento: farlo scorrere avanti e indietro ad ogni
// pescata imiterebbe il gesto della distribuzione iniziale, non quello, ben
// diverso, di pescare una carta da un mazzo che sta li' fermo sul tavolo.
const DECK_CARD_W = 110, DECK_CARD_H = 203
const DECK_HIDDEN_X = -92, DECK_VISIBLE_X = 30, DECK_Y = 560
const DECK_BADGE_HIDDEN_X = 12, DECK_BADGE_VISIBLE_X = 65, DECK_BADGE_Y = 730


// badge dei punteggi: posizione FISSA nelle due strette fasce libere fra
// ventaglio IA / area di presa / mano umana. Deliberatamente NON derivata da
// coord.pile (quella resta solo il punto di arrivo, fuori vista, delle carte
// vinte in una presa): con mani lunghe (Tressette, Marianna) un badge
// ancorato a coord.pile finiva coperto dal ventaglio dell'umano, che occupa
// tutta la fascia bassa
const AI_BADGE_X = 650, AI_BADGE_Y = 280
const HUMAN_BADGE_X = 650, HUMAN_BADGE_Y = 790

export class TableRenderer {
    /**
     * @param {TrickTakingEngine} engine
     * @param {object} opts
     *   humanIndex, aiIndex: indici dei due giocatori nell'array engine.players
     *   imagePath(cardId): string -> url dell'immagine della carta
     *   backImagePath: string -> url del dorso
     *   coord: { pile: { [playerIndex]: {x,y} }, info: {top,left} }
     *     pile.<playerIndex> e' il punto verso cui volano le carte vinte in
     *     una presa (fuori vista, dissolvenza finale); info e' la posizione
     *     del pannello testuale.
     *   formatInfo(engine): string per il pannello info (puo' contenere '\n')
     *   onRoundOver(result): callback per l'orchestrazione a livello di app
     *   sortHand: bool, ordina la mano dell'umano per seme/valore (default true)
     *   handSpacing: distanza MASSIMA in px fra una carta e la successiva in
     *                mano (default 120; si restringe da solo se le carte non
     *                entrano nella fascia bassa, es. le 10 carte del Tressette)
     *   handScroll: { maxWidth } opzionale, attiva lo scorrimento orizzontale
     *               della mano umana invece del restringimento automatico
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
        this._deckVisible = false // vedi _animateDeal: il mazzo scorre in vista una volta sola
        this._backCounter = this._totalDeckSize() // vedi _currentBackId

        this.handLayout = new HandLayout({
            rules: engine.rules,
            sorted: opts.sortHand !== false,
            spacing: opts.handSpacing || HAND_MAX_SPACING,
            // le coordinate vere (centrate, adattive) sono ricalcolate ad ogni
            // _layoutHumanHand: qui serve solo per l'ORDINAMENTO delle carte
            x: 0,
            y: opts.handScroll ? 0 : HAND_Y,
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

    // numero iniziale di carte a testa: usato per centrare in modo STABILE il
    // ventaglio dell'IA (gli slot non vengono mai ricompattati quando l'IA
    // gioca una carta, esattamente come in ScopaRenderer: si formano dei
    // "buchi", non un nuovo centraggio)
    _aiHandSize() { return this.engine.rules.handSize() }

    _aiFanX(slot) {
        const n = this._aiHandSize()
        const startX = (BOARD_W - ((n - 1) * AI_SPACING + AI_CARD_W)) / 2
        return startX + slot * AI_SPACING
    }

    // z-index del ventaglio IA basato sullo SLOT (carta piu' a destra sopra),
    // non sull'ordine di creazione degli <img> nel DOM (quello dei dorsi):
    // e' questo che mantiene la carta centrale correttamente sopra quella
    // alla sua sinistra invece di finirci casualmente sotto
    _aiZIndex(slot) { return AI_Z_BASE + slot }

    // precarica le immagini di tutte le carte del mazzo corrente + i dorsi
    preload(onReady) {
        const cfg = this.engine.rules.deckConfig()
        const ids = []
        for (const s of cfg.suits) for (const r of cfg.ranks) ids.push(`${r}${s}`)
        let loaded = 0
        const total = ids.length
        for (const id of ids) {
            $(`<img src="${this.opts.imagePath(id)}" id="${id}" class="fronte" style="position:absolute;">`)
                .on('load', () => { if (++loaded >= total) onReady() })
                .hide()
                .appendTo('#game-board')
        }
        // uno sprite dorso distinto per OGNI carta del mazzo: nessun riuso,
        // altrimenti due pescate ravvicinate (tipico delle ultime due carte)
        // potrebbero contendersi lo stesso sprite fisico (vedi _currentBackId)
        for (let i = 1; i <= total; i++) {
            $(`<img src="${this.opts.backImagePath}" id="Dorso${i}" class="dorso" style="position:absolute;">`)
                .hide()
                .appendTo('#game-board')
        }

        // badge contatore mazzo, stesso stile/posizione di ScopaRenderer
        $('#game-board').append(`<div id="deck-badge" style="position:absolute; left:${DECK_BADGE_HIDDEN_X}px; top:${DECK_BADGE_Y}px; z-index:100; background-color:#1e3a8a; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">${total}</div>`)

        // badge "punti" per IA e umano, nello stesso stile dei badge di Scopa,
        // in posizione fissa (vedi commento su AI_BADGE_*/HUMAN_BADGE_*)
        $('#game-board').append(`<div id="ai-pile-badge" style="position:absolute; left:${AI_BADGE_X - 27}px; top:${AI_BADGE_Y}px; z-index:100; background-color:#047857; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">0</div>`)
        $('#game-board').append(`<div id="human-pile-badge" style="position:absolute; left:${HUMAN_BADGE_X - 27}px; top:${HUMAN_BADGE_Y}px; z-index:100; background-color:#047857; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">0</div>`)

        $('#game-board').append('<div id="info" style="position:absolute;color:white;background-color:rgba(0,0,0,0.4);font-weight:bold;width:400px;font-family:Arial;font-size:15px;line-height:1.4;text-align:center;white-space:pre-line;padding:8px 15px;border-radius:12px;z-index:100"/>')

        // link "Aiuto" opzionale, sotto il pannello punteggio: attiva la
        // finestra di regole solo a richiesta invece di mostrarla sempre
        // all'avvio. Ogni app (Tressette, Briscola, ...) passa il proprio
        // callback in opts.onHelp; se assente, il link non viene creato.
        if (this.opts.onHelp) {
            $(`<a href="#" id="help-link">Aiuto</a>`)
                .css({
                    position: 'absolute', left: '30px', top: '20px',
                    color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial', fontSize: '90%',
                    textDecoration: 'none', background: 'rgba(0,0,0,0.4)', padding: '8px 16px',
                    borderRadius: '20px', cursor: 'pointer', zIndex: 100,
                })
                .on('click', (e) => { e.preventDefault(); this.opts.onHelp() })
                .appendTo('#game-board')
        }

        // contenitore opzionale a scorrimento orizzontale per la mano dell'umano
        if (this.opts.handScroll) {
            $('#game-board').append(
                `<div id="hand-scroll" style="position:absolute;left:0px;top:${HAND_Y}px;` +
                `width:${this.opts.handScroll.maxWidth}px;height:${HAND_CARD_H + 10}px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;"/>`
            )
        }

        this.updateInfo(this.opts.formatInfo(this.engine))
    }

    // pila del mazzo, "chiusa" e in attesa: dorsi ancora non distribuiti
    // impilati fuori vista a sinistra (li fara' entrare _slideDeck durante la
    // distribuzione), IA gia' servita esclusa (resta nel suo ventaglio),
    // carte gia' giocate escluse (restano nascoste)
    drawDeckStack() {
        let x = DECK_HIDDEN_X, y = DECK_Y, z = -100
        $('img.dorso').not('.in-ai-hand, .spent, .dealing').each(function () {
            $(this).css({ left: x, top: y, width: DECK_CARD_W, height: DECK_CARD_H, zIndex: z }).show()
            x -= 0.1; y -= 0.1; z += 1
        })

        // supporto opzionale: alcuni giochi (es. Briscola) tagliano una carta a
        // inizio smazzata e la lasciano scoperta, di traverso, sotto il mazzo,
        // come ultima carta da pescare. Se il RuleSet la espone (rules.trumpCard),
        // la mostriamo qui; per gli altri giochi (es. Tressette) e' assente e
        // questo blocco non fa nulla. A differenza del resto del mazzo, la
        // "carta di briscola" NON e' un dorso: rimane visibile per l'intera
        // smazzata anche quando il mazzo scompare (_slideDeck la ignora perche'
        // seleziona solo img.dorso).
        const trumpCard = this.engine.rules.trumpCard
        if (trumpCard) {
            const centerX = DECK_VISIBLE_X + DECK_CARD_W // bordo destro della pila (posizione a riposo, mazzo visibile): meta' carta sporge verso il tavolo
            const centerY = DECK_Y + DECK_CARD_H / 2
            $(`#${trumpCard.id}`).show().css({
                left: centerX - DECK_CARD_W / 2, top: centerY - DECK_CARD_H / 2,
                width: DECK_CARD_W, height: DECK_CARD_H, zIndex: -200,
                transform: 'rotate(90deg)', transformOrigin: 'center center',
            })
        }
    }

    // fa scorrere il mazzo dentro/fuori vista, come in ScopaRenderer: esclude
    // i dorsi gia' "in mano" all'IA (.in-ai-hand), gia' giocati (.spent) o
    // attualmente in volo verso la propria destinazione (.dealing).
    // Le prime due esclusioni evitano che ogni nuova carta distribuita li
    // ritrascini verso il mazzo (o, alla chiusura, fuori schermo con il resto).
    // La terza e' altrettanto importante: la distribuzione emette tutti i suoi
    // eventi in sequenza SINCRONA (stesso tick), quindi _animateDeal per la
    // carta N+1 chiama sempre _slideDeck PRIMA che l'animazione della carta N
    // sia arrivata a destinazione. Senza escludere ".dealing", il .animate()
    // di _slideDeck qui sotto la intercetterebbe a meta' strada (jQuery
    // permette una sola animazione per proprieta' per elemento) e il callback
    // di completamento di quella carta non scatterebbe MAI: bug osservato
    // come "la mano dell'IA resta vuota" e "in mano all'umano appare solo
    // l'ultima carta distribuita" (l'unica mai interrotta da un evento successivo).
    _slideDeck(visible) {
        const targetX = visible ? DECK_VISIBLE_X : DECK_HIDDEN_X
        const badgeTargetX = visible ? DECK_BADGE_VISIBLE_X : DECK_BADGE_HIDDEN_X

        $('img.dorso').not('.in-ai-hand, .spent, .dealing').each(function (index) {
            const offset = index * -0.1 // mantiene il micro-effetto 3D dello stack
            $(this).stop(true, false).animate({ left: targetX + offset }, 400)
        })

        $('#deck-badge').stop(true, false).animate({ left: badgeTargetX }, 400)
    }

    updateInfo(text) {
        $('#info').css(this.opts.coord.info).text(text)
        $('#deck-badge').text(this.engine.deck.count())
        // di default il badge mostra i punti della smazzata in corso
        // (engine.rawPoints); un gioco puo' sovrascriverlo con opts.badgeScore
        // per farci mostrare invece un totale diverso (es. Marianna: il
        // punteggio complessivo di partita, che si aggiorna solo a fine
        // smazzata, non mentre si gioca)
        const badgeScore = this.opts.badgeScore || ((engine, idx) => engine.rawPoints[idx])
        $('#ai-pile-badge').text(badgeScore(this.engine, this.opts.aiIndex))
        $('#human-pile-badge').text(badgeScore(this.engine, this.opts.humanIndex))
    }

    // --- disposizione della mano dell'umano (ordinata e, se attivo, scorrevole) ---

    // ricalcola e anima la posizione di tutte le carte visibili in mano
    // all'umano, secondo l'ordine deciso da HandLayout (vedi ui/HandLayout.js),
    // centrando pero' la fascia bassa come in ScopaRenderer: lo spacing si
    // restringe da solo quando le carte non entrerebbero (es. le 10 carte del
    // Tressette), a meno che sia attivo opts.handScroll.
    //
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
        const n = entries.length

        const maxSpacing = this.opts.handSpacing || HAND_MAX_SPACING
        const spacing = scrollable
            ? maxSpacing
            : (n > 1 ? Math.min(maxSpacing, (HAND_MAX_WIDTH - HAND_CARD_W) / (n - 1)) : 0)
        const totalWidth = n > 0 ? (n - 1) * spacing + HAND_CARD_W : 0
        const startX = scrollable ? 0 : (BOARD_W - totalWidth) / 2

        entries.forEach(({ card }, i) => {
            const el = $(`#${card.id}`)
            if (scrollable) {
                // dentro il contenitore a scorrimento le coordinate sono relative
                // al contenitore stesso, non alla pagina
                if (el.parent().attr('id') !== 'hand-scroll') el.appendTo('#hand-scroll')
            }
            const left = startX + i * spacing
            const top = HAND_Y
            el.css('zIndex', 200 + i) // sempre ricalcolato: mai lasciato allo slot di pescata
            if (animate) el.stop(true, false).animate({ left, top, width: HAND_CARD_W, height: HAND_CARD_H }, 300)
            else el.stop(true, false).css({ left, top, width: HAND_CARD_W, height: HAND_CARD_H })
        })

        if (scrollable) {
            $('#hand-scroll').css('min-width', totalWidth)
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

        // il mazzo scorre in vista SOLO per la mazzata iniziale, e una volta
        // sola (non ad ogni carta: vedi _deckVisible); durante le pescate
        // successive resta fermo dov'e' — vedi il commento su DECK_HIDDEN_X
        // piu' in alto nel file
        if (!isRedraw && !this._deckVisible) {
            this._slideDeck(true)
            this._deckVisible = true
        }

        // difensivo: se questa carta aveva gia' un'immagine visibile a schermo
        // per qualche motivo (es. la carta di briscola esposta sotto il mazzo
        // in Briscola: vedi BriscolaRules.trumpCard e drawDeckStack), la
        // nascondiamo ora che sta per essere presa in mano
        $(`#${card.id}`).hide()

        const tempo = isRedraw ? (isHuman ? 900 : 500) : 700 - (playerIndex === this.opts.aiIndex ? 100 : 0)

        // destinazione "grezza" del tragitto dal mazzo: per l'umano e' una
        // posizione qualunque nella fascia bassa (ci pensera' _layoutHumanHand
        // a rimettere in ordine, centrato, subito dopo la rivelazione); per
        // l'IA e' invece la posizione DEFINITIVA nel ventaglio (piccola, in alto)
        const dest = isHuman
            ? { left: BOARD_W / 2 - HAND_CARD_W / 2, top: HAND_Y, width: HAND_CARD_W, height: HAND_CARD_H }
            : { left: this._aiFanX(slot), top: AI_Y, width: AI_CARD_W, height: AI_CARD_H }

        $(`#${backId}`).show().addClass('dealing').css({ left: DECK_VISIBLE_X, top: DECK_Y, width: DECK_CARD_W, height: DECK_CARD_H, zIndex: 300 })
            .stop(true, false)
            .animate(dest, tempo, () => {
                $(`#${backId}`).removeClass('dealing')
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
                    // coperta e resta "in mano" all'IA. revealZIndex la porta
                    // sopra le carte vicine del ventaglio mentre e' mostrata
                    // (altrimenti, essendo per costruzione sotto chi le sta alla
                    // destra, risultava visibile solo per un terzo/due terzi);
                    // restZIndex la riporta al suo posto naturale nel ventaglio
                    // una volta ricoperta.
                    this._flipReveal(backId, card, dest, slot, {
                        holdMs: 900,
                        isStale,
                        revealZIndex: 400,
                        restZIndex: this._aiZIndex(slot),
                        onCovered: () => { $(`#${backId}`).removeClass('spent').addClass('in-ai-hand'); this._aiHandBack[slot] = backId },
                    })
                } else {
                    // pescata privata (es. Briscola) o mazzata iniziale: resta
                    // sempre coperta, non viene mai mostrata
                    $(`#${backId}`).addClass('in-ai-hand').css('zIndex', this._aiZIndex(slot))
                    this._aiHandBack[slot] = backId
                }

                // ultima carta del mazzo appena pescata: non servira' piu' per
                // il resto della smazzata, quindi lo tiriamo via (una volta sola)
                if (isRedraw && this._deckVisible && this.engine.deck.isEmpty()) {
                    this._deckVisible = false
                    this._slideDeck(false)
                }
            })
    }

    // Coreografia del "giro carta": nasconde il dorso, mostra la faccia al suo posto.
    // Se keepFaceUp e' false, dopo holdMs la ricopre di nuovo (dorso al posto della faccia).
    // isStale() interrompe la coreografia (senza toccare piu' nulla) se lo slot e'
    // stato rigiocato nel frattempo, ad ogni fase intermedia.
    // revealZIndex: z-index della carta mentre e' mostrata a faccia in su (default:
    // sopra la mano/il ventaglio ma sotto le carte "in volo", cosi' resta sempre
    // interamente visibile anche se e' in mezzo al ventaglio dell'IA, circondata da
    // carte a z-index piu' alto). restZIndex: z-index del dorso quando ricopre (per
    // l'IA dev'essere quello del proprio slot nel ventaglio, altrimenti l'ordine di
    // sovrapposizione torna a dipendere dall'ordine di creazione nel DOM).
    _flipReveal(backId, card, dest, slot, { keepFaceUp, holdMs = 500, onFlipped, onCovered, isStale = () => false, revealZIndex = 400, restZIndex = slot }) {
        $(`#${backId}`).css({ transition: '0.5s', transform: 'rotateY(90deg)', transformOrigin: '33% 50%', transformStyle: 'preserve-3d' })
        setTimeout(() => {
            if (isStale()) return
            $(`#${backId}`).hide().css({ transition: '', transform: '' })
            $(`#${card.id}`).show().css({ left: dest.left, top: dest.top, width: dest.width, height: dest.height, zIndex: revealZIndex, transition: '', transform: '' })
            if (onFlipped) onFlipped()
            if (keepFaceUp) return

            setTimeout(() => {
                if (isStale()) return
                $(`#${card.id}`).css({ transition: '0.5s', transform: 'rotateY(90deg)', transformOrigin: '33% 50%', transformStyle: 'preserve-3d' })
                setTimeout(() => {
                    if (isStale()) return
                    $(`#${card.id}`).hide().css({ transition: '', transform: '' })
                    $(`#${backId}`).show().css({ left: dest.left, top: dest.top, width: dest.width, height: dest.height, zIndex: restZIndex, transition: '', transform: '' })
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

    // Disposizione di UNA presa (le due carte), generata una volta sola al
    // primo calo e poi riletta identica per il secondo (vedi _animatePlay):
    // altrimenti le due carte, generate ciascuna per conto proprio, non
    // avrebbero alcuna relazione spaziale sensata fra loro.
    //
    // Il punto base e' scelto a caso in tutta la zona libera (TABLE_ZONE_*),
    // poi le due carte vengono scostate da quel punto in versi opposti di
    // TABLE_PAIR_OFFSET_* +/- un margine casuale (TABLE_JITTER): a seconda di
    // come cade il dado, il risultato puo' somigliare a due carte affiancate,
    // quasi sovrapposte, o incrociate — mai pero' fuori dalla zona sicura,
    // perche' ogni coordinata finale viene comunque "agganciata" (clamp)
    // dentro i limiti di TABLE_ZONE_*.
    _randomTrickLayout() {
        const clampX = (v) => Math.min(TABLE_ZONE_X_MAX, Math.max(TABLE_ZONE_X_MIN, v))
        const clampY = (v) => Math.min(TABLE_ZONE_Y_MAX, Math.max(TABLE_ZONE_Y_MIN, v))
        const jitter = () => (Math.random() - 0.5) * TABLE_JITTER
        const rotate = () => (Math.random() - 0.5) * 2 * TABLE_ROTATE_MAX_DEG

        const baseX = TABLE_ZONE_X_MIN + Math.random() * (TABLE_ZONE_X_MAX - TABLE_ZONE_X_MIN)
        const baseY = TABLE_ZONE_Y_MIN + Math.random() * (TABLE_ZONE_Y_MAX - TABLE_ZONE_Y_MIN)

        return [
            { left: clampX(baseX - TABLE_PAIR_OFFSET_X / 2 + jitter()), top: clampY(baseY - TABLE_PAIR_OFFSET_Y / 2 + jitter()), rotate: rotate() },
            { left: clampX(baseX + TABLE_PAIR_OFFSET_X / 2 + jitter()), top: clampY(baseY + TABLE_PAIR_OFFSET_Y / 2 + jitter()), rotate: rotate() },
        ]
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
            if (backId) { $(`#${backId}`).removeClass('in-ai-hand').addClass('spent').hide(); delete this._aiHandBack[slot] }
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
            // valida assegnata, quindi va sempre impostata esplicitamente —
            // nel ventaglio piccolo dell'IA, cosi' il "giro carta" avviene li'
            // (dove l'utente la vede davvero) e non "dal nulla"
            card$.css({ left: this._aiFanX(slot), top: AI_Y, width: AI_CARD_W, height: AI_CARD_H, zIndex: this._aiZIndex(slot) })
        }

        card$.css({ transition: '', transform: '' })

        // NB: a questo punto la carta e' GIA' stata inserita in engine.trick
        // (l'evento cardPlayed viene emesso dopo il push), quindi trick.length
        // vale gia' 1 anche per la prima carta di una presa a 2 giocatori: il
        // criterio corretto e' length>1, non length>=1
        const isSecond = this.engine.trick.length > 1
        if (!isSecond) this._trickLayout = this._randomTrickLayout() // nuova presa: nuova disposizione casuale
        const dest = this._trickLayout[isSecond ? 1 : 0]
        // la rotazione va impostata SUBITO (non e' animabile da jQuery.animate,
        // che sa interpolare solo proprieta' numeriche semplici): con una
        // transition CSS ruota comunque in modo fluido, in parallelo al volo
        // posizionale gestito da .animate()
        card$.show().css({ zIndex: (isSecond ? 1 : 0) + 3, transition: 'transform 0.5s' })
            .animate({ left: dest.left, top: dest.top, width: TABLE_CARD_W, height: TABLE_CARD_H }, 500)
        card$.css('transform', `rotate(${dest.rotate}deg)`)

        if (isHuman) this._layoutHumanHand() // richiude il ventaglio sulle carte rimaste
    }

    // Presa in due fasi, come nella realta':
    //  1) le due carte si "posano" sul tavolo (gia' avvenuto con _animatePlay:
    //     qui aspettiamo solo che quel tragitto sia visivamente concluso)
    //  2) SOLO DOPO, insieme, volano verso chi le ha prese (rimpicciolendo,
    //     come in ScopaRenderer) e dissolvono sulla pila (coord.pile)
    _animateResolve({ trick, winnerIndex }) {
        const pile = this.opts.coord.pile[winnerIndex]

        setTimeout(() => {
            const fadeMs = this.FADE_MS
            trick.forEach(({ card }) => {
                $(`#${card.id}`)
                    .stop(true, false)
                    .css('zIndex', 300)
                    .animate({ left: pile.x, top: pile.y, width: AI_CARD_W, height: AI_CARD_H }, this.FLY_TO_WINNER_MS, function () {
                        $(this).fadeOut(fadeMs)
                    })
            })
        }, this.TABLE_SETTLE_MS)

        setTimeout(() => {
            this.attesa = false
            this.updateInfo(this.opts.formatInfo(this.engine))
        }, this.RESOLVE_ANIM_MS)
    }

    _showDialog(title, text, onClose) {
        $(`<div title="${title}"/>`).html(text).dialog({
            modal: true,
            width: responsiveDialogWidth(360),
            buttons: { Ok: function () { $(this).dialog('close') } },
            close: function () {
                if (onClose) onClose()
                $(this).dialog('destroy').remove()
            },
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
        this._deckVisible = false
        this._trickLayout = null

        $('img.dorso').removeClass('in-ai-hand spent dealing')
        $('img').each(function () {
            $(this).stop(true, false).hide().off('click').css({ transition: '', transform: '', transformOrigin: '', transformStyle: '', zIndex: 0 })
        })
        if (this.opts.handScroll) $('#hand-scroll').children().appendTo('#game-board')

        $('#deck-badge').text(this._totalDeckSize()).css({ left: DECK_BADGE_HIDDEN_X })
        $('#ai-pile-badge').text('0')
        $('#human-pile-badge').text('0')

        this.drawDeckStack()
    }

    showMessage(title, text, onClose) { this._showDialog(title, text, onClose) }
}
