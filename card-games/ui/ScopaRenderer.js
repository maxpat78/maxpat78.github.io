// Interfaccia per la Scopa: diversa da TableRenderer.js (Tressette/Briscola)
// perche' il modello di interazione e' diverso, non solo la grafica:
//  - il tavolo e' PERSISTENTE (le carte ci restano per piu' turni, non solo
//    per la durata di una mano di presa), quindi va disegnato come una riga
//    che cresce e si restringe nel tempo, non come due soli slot fissi;
//  - una giocata puo' richiedere di scegliere QUALE combinazione di carte
//    del tavolo catturare (se ce n'e' piu' di una legale), quindi serve
//    selezione multipla sul tavolo, non un semplice click-e-vai;
//  - non c'e' la coreografia "mostra la carta pescata": la Scopa distribuisce
//    le carte a gruppi di 3, sempre coperte (vedi ScopaRules).
//
// Riusa comunque: le stesse convenzioni di preload/immagini, e HandLayout
// (qui usato per DUE scopi: il ventaglio della mano umana E la disposizione
// in riga delle carte sul tavolo, che e' esattamente lo stesso problema
// "metti n carte in fila, una accanto all'altra" con parametri diversi).

import { HandLayout } from './HandLayout.js'

export class ScopaRenderer {
    /**
     * @param {CaptureEngine} engine
     * @param {object} opts
     *   humanIndex, aiIndex
     *   imagePath(cardId), backImagePath
     *   coord: { human:{x,y}, ai:{x,y}, table:{x,y}, info:{top,left} }
     *   formatInfo(engine): string
     *   onHandOver(result), onHelp
     *   sortHand: bool (default true)
     */
    constructor(engine, opts) {
        this.engine = engine
        this.opts = opts

        this._aiHandBack = {}     // { slot: backElementId } - dorsi in mano all'IA
        this._backCounter = this._totalDeckSize()

        this._selectedSlot = null       // slot in mano umana attualmente scelto per la mossa
        this._pendingOptions = []       // combinazioni di presa legali per quella carta
        this._selectedTableIds = new Set()

        this.handLayout = new HandLayout({
            rules: engine.rules,
            sorted: opts.sortHand !== false,
            spacing: opts.handSpacing || 90,
            x: opts.coord.human.x,
            y: opts.coord.human.y,
        })
        this.tableLayout = new HandLayout({
            rules: engine.rules,
            sorted: false, // il tavolo mantiene l'ordine con cui le carte sono arrivate, non ha senso ordinarlo per seme/valore
            spacing: opts.tableSpacing || 70,
            x: opts.coord.table.x,
            y: opts.coord.table.y,
        })

        this._bindEngineEvents()
    }

    _totalDeckSize() {
        const cfg = this.engine.rules.deckConfig()
        return cfg.suits.length * cfg.ranks.length
    }

    _currentBackId() { return `Dorso${this._backCounter--}` }

    _bindEngineEvents() {
        this.engine.on('deal', (payload) => this._animateDeal(payload))
        this.engine.on('cardPlayed', (payload) => this._animatePlay(payload))
        this.engine.on('finalSweep', (payload) => this._animateFinalSweep(payload))
        this.engine.on('handOver', (result) => this._onHandOver(result))
        this.engine.on('turnChanged', ({ turnIndex }) => this._onTurnChanged(turnIndex))
    }

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
        for (let i = 1; i <= total; i++) {
            $(`<img src="${this.opts.backImagePath}" id="Dorso${i}" class="dorso" width="150px" height="277px" style="position:absolute">`)
                .hide()
                .appendTo('#game-board')
        }
        $('#game-board').append('<div id="info" style="position:absolute;color:white;background-color:transparent;font-weight:bold;width:fit-content;font-family:Arial;font-size:95%;line-height:1.25;white-space:pre-line;z-index:100"/>')
        $('#game-board').append('<button id="conferma-presa" style="position:absolute;display:none;z-index:200">Conferma presa</button>')
        $('#conferma-presa').on('click', () => this._confirmCapture())

        if (this.opts.onHelp) {
            const c = this.opts.coord.info
            $(`<a href="#" id="help-link">Aiuto</a>`)
                .css({ position: 'absolute', left: c.left, top: c.top + 40, color: 'white', fontFamily: 'Arial', fontSize: '85%', textDecoration: 'underline', cursor: 'pointer', zIndex: 100 })
                .on('click', (e) => { e.preventDefault(); this.opts.onHelp() })
                .appendTo('#game-board')
        }
    }

    //~ updateInfo(text) { $('#info').css(this.opts.coord.info).text(text) }
    updateInfo(text) { 
        $('#info')
            .css({
                ...this.opts.coord.info,
                'font-size': '13px',       // Rende il font leggermente più compatto
                'line-height': '1.3',      // Riduce lo spazio verticale tra le righe
                'text-align': 'center'     // Mantiene il testo ben centrato
            })
            .html(text.replace(/\n/g, '<br>')) // Converte i \n in andata a capo HTML <br>
    }

    // --- distribuzione ---

    _animateDeal({ target, playerIndex, slot, card }) {
            const from = { left: 10, top: 293 } // dal mazzo
            
            // PRELEVAMO SEMPRE un dorso per ogni singola carta distribuita
            const backId = this._currentBackId() 

            if (target === 'table') {
                // Nascondiamo il dorso per far assottigliare il mazzo
                $(`#${backId}`).hide() 
                
                // BONUS: Invece di far apparire le carte sul tavolo istantaneamente, 
                // le impostiamo alle coordinate del mazzo. Quando _layoutTable() 
                // entra in azione, le farà "volare" dal mazzo fino alla riga sul tavolo!
                $(`#${card.id}`).show().css(from)
                this._layoutTable()
                return
            }
            
            // target === 'hand'
            const isHuman = playerIndex === this.opts.humanIndex
            if (isHuman) {
                // Nascondiamo il dorso anche per le carte umane per scalare il mazzo
                $(`#${backId}`).hide() 
                
                $(`#${card.id}`).show().css(from)
                    .animate({ left: this.opts.coord.human.x, top: this.opts.coord.human.y }, 500, () => {
                        $(`#${card.id}`).off('click').on('click', () => this._onHumanCardClick(slot))
                        this._layoutHand()
                    })
            } else {
                // L'IA usa direttamente il dorso, che quindi si stacca dal mazzo
                this._aiHandBack[slot] = backId
                $(`#${backId}`).show().css(from)
                    .animate({ left: this.opts.coord.ai.x + slot * 90, top: this.opts.coord.ai.y }, 500)
            }
        }

    // 1. Aggiorna _layoutHand per riagganciare SEMPRE il click alle carte in mano all'umano
    _layoutHand() {
        const hand = this.engine.players[this.opts.humanIndex].hand
        const entries = this.handLayout.layout(hand)
        entries.forEach(({ slot, card, left, top }, i) => {
            $(`#${card.id}`)
                .css('zIndex', i)
                .stop(true, false)
                .animate({ left, top }, 300)
                // Assicura che il click sia sempre registrato e legato allo slot aggiornato:
                .off('click')
                .on('click', () => this._onHumanCardClick(slot))
        })
    }

    _layoutTable() {
        const entries = this.tableLayout.layout(this.engine.table)
        entries.forEach(({ card, left, top }, i) => {
            $(`#${card.id}`).show().css('zIndex', i).stop(true, false).animate({ left, top }, 300)
                .off('click').on('click', () => this._onTableCardClick(card))
        })
    }

    // --- interazione umana ---

    _onHumanCardClick(slot) {
        try {
            // il blocco si basa sul turno REALE del motore (sempre coerente,
            // aggiornato in modo sincrono da engine.playCard), non su un flag
            // temporizzato dall'animazione: quest'ultimo poteva restare bloccato
            // se la callback di fine-animazione non scattava come previsto,
            // lasciando i click permanentemente senza effetto
            if (this.engine.turnIndex !== this.opts.humanIndex) return
            const rules = this.engine.rules
            const card = this.engine.players[this.opts.humanIndex].hand[slot]
            if (!card) return

            const options = rules.findCaptures(card, this.engine.table)

            this._clearSelection()

            if (options.length === 0) {
                this._playHuman(slot, null)
                return
            }
            if (options.length === 1) {
                this._playHuman(slot, options[0])
                return
            }

            // piu' combinazioni possibili: entra in modalita' selezione. L'utente
            // clicca le carte del tavolo per comporre la presa voluta, poi conferma.
            this._selectedSlot = slot
            this._pendingOptions = options
            $(`#${card.id}`).css({ outline: '3px solid gold' })
            this._highlightEligibleTableCards()
            this.updateInfo(this.opts.formatInfo(this.engine) + '\nScegli le carte da prendere, poi conferma.')
        } catch (err) {
            // un'eccezione qui, prima, lasciava il click "silenzioso": l'utente
            // vedeva solo che non succedeva nulla, senza modo di capire perche'
            console.error('Errore nel gestire il click sulla carta:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa e\' andato storto: ' + err.message)
        }
    }

    _highlightEligibleTableCards() {
        const eligibleIds = new Set(this._pendingOptions.flat().map(c => c.id))
        for (const card of this.engine.table) {
            $(`#${card.id}`).css({ outline: eligibleIds.has(card.id) ? '2px dashed white' : 'none', opacity: eligibleIds.has(card.id) ? 1 : 0.6 })
        }
    }

    _onTableCardClick(card) {
        try {
            if (this.engine.turnIndex !== this.opts.humanIndex || this._selectedSlot === null) return
            const eligibleIds = new Set(this._pendingOptions.flat().map(c => c.id))
            if (!eligibleIds.has(card.id)) return

            if (this._selectedTableIds.has(card.id)) this._selectedTableIds.delete(card.id)
            else this._selectedTableIds.add(card.id)

            $(`#${card.id}`).css({ outline: this._selectedTableIds.has(card.id) ? '3px solid gold' : '2px dashed white' })

            const matches = this._pendingOptions.some(opt => this._sameIds(opt, [...this._selectedTableIds]))
            $('#conferma-presa').css({
                display: matches ? 'inline-block' : 'none',
                left: this.opts.coord.table.x, top: this.opts.coord.table.y - 40,
            })
        } catch (err) {
            console.error('Errore nel gestire il click su una carta del tavolo:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa e\' andato storto: ' + err.message)
        }
    }

    _sameIds(cards, ids) {
        if (cards.length !== ids.length) return false
        const a = cards.map(c => c.id).sort()
        const b = [...ids].sort()
        return a.every((id, i) => id === b[i])
    }

    _confirmCapture() {
        try {
            if (this._selectedSlot === null) return
            const chosen = this._pendingOptions.find(opt => this._sameIds(opt, [...this._selectedTableIds]))
            if (!chosen) return
            const slot = this._selectedSlot
            this._clearSelection()
            this._playHuman(slot, chosen)
        } catch (err) {
            console.error('Errore nel confermare la presa:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa e\' andato storto: ' + err.message)
        }
    }

    _clearSelection() {
        for (const card of this.engine.table) $(`#${card.id}`).css({ outline: 'none', opacity: 1 })
        if (this._selectedSlot !== null) {
            const card = this.engine.players[this.opts.humanIndex].hand[this._selectedSlot]
            if (card) $(`#${card.id}`).css({ outline: 'none' })
        }
        this._selectedSlot = null
        this._pendingOptions = []
        this._selectedTableIds = new Set()
        $('#conferma-presa').hide()
    }

    _playHuman(slot, capture) {
        const result = this.engine.playCard(this.opts.humanIndex, slot, capture)
        if (!result.ok) this._showDialog('Errore', result.reason)
    }

    // --- IA ---

    playAiTurn() {
        const ai = this.engine.players[this.opts.aiIndex]
        if (ai.isHuman || ai.isHandEmpty()) return
        const view = this.engine.buildView(this.opts.aiIndex)
        const move = ai.strategy.chooseMove(view)
        this.engine.playCard(this.opts.aiIndex, move.slot, move.capture)
    }

    // 2. Resetta le selezioni del turno precedente ad ogni cambio turno
    _onTurnChanged(turnIndex) {
        this._clearSelection() // Pulisce contorni e selezioni pendenti
        
        // Ripristina l'interattività e il layout per la mano dell'umano
        if (turnIndex === this.opts.humanIndex) {
            this._layoutHand()
        } else if (turnIndex === this.opts.aiIndex) {
            if (this.engine.handOver) return
            setTimeout(() => this.playAiTurn(), 900)
        }
    }

    // --- animazione della giocata (con o senza presa) ---

    _animatePlay({ playerIndex, card, slot, captured, isScopa }) {
        const isHuman = playerIndex === this.opts.humanIndex

        const card$ = $(`#${card.id}`)
        card$.stop(true, false)

        if (isHuman) {
            // la carta e' gia' visibile e posizionata (e' nel ventaglio):
            // non serve impostare una posizione di partenza, resta dov'e'
        } else {
            // nasconde il dorso corrispondente allo slot appena giocato dall'IA
            // (e' cosi' che si vede la sua mano assottigliarsi) e posiziona la
            // carta reale (finora mai mostrata) al suo posto, pronta a muoversi
            const backId = this._aiHandBack[slot]
            if (backId) { $(`#${backId}`).hide(); delete this._aiHandBack[slot] }
            card$.css({ left: this.opts.coord.ai.x + slot * 90, top: this.opts.coord.ai.y, zIndex: 100 })
        }
        card$.css({ transition: '', transform: '' }).show()

        if (isHuman) this._layoutHand() // richiude subito il ventaglio sulle carte rimaste

        if (captured.length === 0) {
            // nessuna presa: la carta si aggiunge al tavolo. Anima DIRETTAMENTE
            // verso la sua posizione finale nella riga (calcolata da _layoutTable,
            // che gia' usa .stop(true,false) prima di ogni .animate()): niente
            // passaggio intermedio verso un punto fisso e poi una seconda
            // animazione per "spargere" le carte, che poteva entrare in corsa
            // con qualunque altro ricalcolo del tavolo nel frattempo.
            this._layoutTable()
            this.updateInfo(this.opts.formatInfo(this.engine))
            return
        }

        // presa: la carta giocata e tutte quelle catturate volano verso
        // l'indicatore delle prese del giocatore e svaniscono (per esplicita
        // scelta di semplificazione: non si simula il mazzetto fisico, solo
        // il conteggio - vedi opts.coord.pile)
        // Pausa prima di far partire il volo: 750ms per il PC, 0ms per l'umano
        const delayBeforeFly = isHuman ? 0 : 750
    
        setTimeout(() => {
            const pile = this.opts.coord.pile[playerIndex]
            const flying = [card, ...captured]
            flying.forEach((c, i) => {
                $(`#${c.id}`).show().stop(true, false)
                    .animate({ left: pile.x, top: pile.y }, 400 + i * 60, function () {
                        $(this).fadeOut(200)
                    })
            })
            setTimeout(() => {
                this._layoutTable()
                this.updateInfo(this.opts.formatInfo(this.engine) + (isScopa ? '\n\n🌟 SCOPA!' : ''))
            }, 400 + flying.length * 60 + 250)
        }, delayBeforeFly)
    }

    _animateFinalSweep({ playerIndex, cards }) {
        const pile = this.opts.coord.pile[playerIndex]
        cards.forEach((c, i) => {
            $(`#${c.id}`).stop(true, false)
                .animate({ left: pile.x, top: pile.y }, 400 + i * 60, function () { $(this).fadeOut(200) })
        })
    }

    _onHandOver(result) {
        if (this.opts.onHandOver) this.opts.onHandOver(result)
    }

    _showDialog(title, text, onClose) {
        // Sostituisci .text(text) con .html(text)
        $(`<div title="${title}"/>`).html(text).dialog({
            modal: true,
            width: 360, // Aggiunto per dare la larghezza adeguata alla tabella
            buttons: { Ok: function () { $(this).dialog('close'); if (onClose) onClose() } },
        })
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

    showMessage(title, text, onClose) { this._showDialog(title, text, onClose) }

    reset() {
            this._aiHandBack = {}
            this._backCounter = this._totalDeckSize()
            this._clearSelection()
            $('img').each(function () {
                $(this).stop(true, false).hide().off('click').css({ transition: '', transform: '', outline: 'none', opacity: 1, zIndex: 0 })
            })
            
            // Aggiungiamo questa riga per far ricomparire il mazzo all'inizio di ogni nuova smazzata!
            this.drawDeckStack()
        }
}
