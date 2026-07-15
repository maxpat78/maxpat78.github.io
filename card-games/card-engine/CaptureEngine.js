//
// Motore generico per giochi "di presa per abbinamento/somma" (Scopa,
// Cassino, ...). Diverso da TrickTakingEngine: li' due carte giocate nello
// STESSO turno si confrontano fra loro; qui UNA carta giocata si confronta
// con un insieme di carte gia' presenti sul tavolo, che restano visibili
// anche per piu' turni finche' qualcuno non le cattura.
//
// Un RuleSet per questo motore deve fornire:
//   deckConfig()                     -> {suits, ranks}
//   handSize()                       -> carte per round di distribuzione
//   tableSize()                      -> carte iniziali scoperte sul tavolo
//   findCaptures(playedCard, table)  -> Card[][]: array di combinazioni
//                                       valide (ognuna un sottoinsieme del
//                                       tavolo). Array vuoto = nessuna presa
//                                       possibile con questa carta.
//   computeHandScore(ctx)            -> {scores:[...], ...}  (vedi ScopaRules)

import { Deck } from './Deck.js'

export class CaptureEngine {
    constructor(players, rules) {
        this.players = players
        this.rules = rules
        this.deck = new Deck(rules.deckConfig())
        this.table = []                              // Card[] scoperte sul tavolo
        this.captured = this.players.map(() => [])   // Card[] catturate da ciascun giocatore
        this.scopeCount = this.players.map(() => 0)
        this.lastCaptureBy = null
        this.turnIndex = 0
        this.handOver = false
        this._listeners = {}
    }

    on(event, cb) {
        (this._listeners[event] ??= []).push(cb)
        return this
    }

    emit(event, payload) {
        for (const cb of this._listeners[event] ?? []) cb(payload)
    }

    // distribuisce le 3 carte a testa iniziali e le 4 scoperte sul tavolo,
    // poi fissa chi gioca per primo (il giocatore alla sinistra del mazziere)
    setup(leaderIndex) {
        this.turnIndex = leaderIndex
        for (let slot = 0; slot < this.rules.handSize(); slot++) {
            for (let p = 0; p < this.players.length; p++) {
                const card = this.deck.draw()
                this.players[p].receive(card, slot)
                this.emit('deal', { target: 'hand', playerIndex: p, slot, card })
            }
        }
        for (let i = 0; i < this.rules.tableSize(); i++) {
            const card = this.deck.draw()
            this.table.push(card)
            this.emit('deal', { target: 'table', card })
        }
    }

    isHandsEmpty() { return this.players.every(p => p.isHandEmpty()) }

    // ridistribuisce un altro giro di carte quando le mani si esauriscono,
    // se il mazzo ne ha ancora
    _redealIfNeeded() {
        if (!this.isHandsEmpty() || this.deck.isEmpty()) return false
        for (let slot = 0; slot < this.rules.handSize(); slot++) {
            for (let p = 0; p < this.players.length; p++) {
                if (this.deck.isEmpty()) break
                const card = this.deck.draw()
                this.players[p].receive(card, slot)
                this.emit('deal', { target: 'hand', playerIndex: p, slot, card })
            }
        }
        return true
    }

    // vista dello stato di gioco esposta a una strategy IA (o alla UI per
    // calcolare le combinazioni di presa disponibili): il tavolo e' pubblico
    // per natura, quindi non c'e' bisogno di distinguere carte "note" da
    // "ignote" come nei giochi a prese classici (qui l'unica incertezza reale
    // e' la mano dell'avversario, sempre coperta)
    buildView(playerIndex) {
        const opponent = this.players[1 - playerIndex]
        return {
            playerIndex,
            hand: this.players[playerIndex].hand,
            table: [...this.table],
            unseenCards: [...this.deck.cards, ...(opponent ? opponent.cardsInHand() : [])],
            deckCount: this.deck.count(),
            rules: this.rules,
        }
    }

    // captureCards: Card[] scelto dal chiamante fra le combinazioni restituite
    // da rules.findCaptures(card, table); null/[] se non tenta alcuna presa
    playCard(playerIndex, slot, captureCards) {
        if (playerIndex !== this.turnIndex) return { ok: false, reason: "non e' il tuo turno" }
        const player = this.players[playerIndex]
        const card = player.hand[slot]
        if (!card) return { ok: false, reason: 'slot vuoto' }

        const legalOptions = this.rules.findCaptures(card, this.table)
        let chosen = null
        if (legalOptions.length) {
            if (!captureCards || !captureCards.length)
                return { ok: false, reason: "una presa e' possibile e va effettuata" }
            chosen = legalOptions.find(opt => this._sameCards(opt, captureCards))
            if (!chosen) return { ok: false, reason: 'combinazione di presa non valida' }
        } else if (captureCards && captureCards.length) {
            return { ok: false, reason: 'nessuna presa possibile con questa carta' }
        }

        player.play(slot)

        let isScopa = false
        if (chosen) {
            const chosenIds = new Set(chosen.map(c => c.id))
            this.table = this.table.filter(c => !chosenIds.has(c.id))
            this.captured[playerIndex].push(card, ...chosen)
            this.lastCaptureBy = playerIndex
            const isLastCardOfHand = this.deck.isEmpty() && this.players.every(p => p.hand.length === 0)
            // Vale scopa solo se il tavolo si svuota E NON è l'ultima giocata della smazzata
            isScopa = (this.table.length === 0) && !isLastCardOfHand
            //isScopa = this.table.length === 0 // eccezione per l'ultima presa gestita in _finishHand
            if (isScopa) this.scopeCount[playerIndex]++
        } else {
            this.table.push(card)
        }

        this.emit('cardPlayed', { playerIndex, card, slot, captured: chosen ?? [], isScopa })

        this.turnIndex = (this.turnIndex + 1) % this.players.length

        if (this._redealIfNeeded()) this.emit('redeal', {})

        if (this.isHandsEmpty() && this.deck.isEmpty()) {
            this._finishHand()
        } else {
            this.emit('turnChanged', { turnIndex: this.turnIndex })
        }

        return { ok: true, captured: chosen ?? [], isScopa }
    }

    _sameCards(a, b) {
        if (a.length !== b.length) return false
        const idsA = a.map(c => c.id).sort()
        const idsB = b.map(c => c.id).sort()
        return idsA.every((id, i) => id === idsB[i])
    }

    // fine smazzata: le carte eventualmente rimaste sul tavolo vanno a chi
    // ha fatto l'ultima presa, ma NON e' una scopa (regola esplicita)
    _finishHand() {
        if (this.table.length && this.lastCaptureBy !== null) {
            this.captured[this.lastCaptureBy].push(...this.table)
            this.emit('finalSweep', { playerIndex: this.lastCaptureBy, cards: [...this.table] })
            this.table = []
        }
        this.handOver = true
        const result = this.rules.computeHandScore({
            capturedCards: this.captured,
            scopeCount: this.scopeCount,
        })
        this.emit('handOver', result)
    }

    // riavvia una nuova smazzata riusando lo stesso engine/players
    startNewHand(leaderIndex) {
        this.deck = new Deck(this.rules.deckConfig())
        this.table = []
        this.captured = this.players.map(() => [])
        this.scopeCount = this.players.map(() => 0)
        this.lastCaptureBy = null
        this.handOver = false
        for (const p of this.players) p.hand = []
        this.setup(leaderIndex)
    }
}
