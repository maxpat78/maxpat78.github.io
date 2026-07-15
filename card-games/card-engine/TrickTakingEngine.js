// card-engine/TrickTakingEngine.js
import { Deck } from './Deck.js'

// Un RuleSet (vedi games/tressette/TressetteRules.js) deve fornire:
//   deckConfig()                                  -> {suits, ranks}
//   handSize()                                     -> numero di carte a testa
//   isLegalPlay(hand, card, trick, leadSuit)       -> bool
//   trickWinner(trick, leadSuit)                   -> indice (0-based, relativo a trick[]) del vincitore
//   trickPoints(trick)                             -> punti "grezzi" presi in questa mano
//   drawAfterTrick()                               -> bool (si ripesca dopo ogni mano di presa?)
//   computeRoundScore(ctx)                         -> {scores:[...], notes:[...]}  (gestisce bonus ultima presa, cappotto, ecc.)
//   isRoundOver(ctx)                                -> bool (default: mani vuote e mazzo vuoto)
// Opzionali:
//   revealsDrawnCards()                            -> bool (la pescata e' pubblica? default: la UI assume di no se assente)
//   setupDeck(deck)                                -> manipola il mazzo appena mescolato PRIMA della distribuzione
//                                                      (es. il taglio della briscola: vedi games/briscola/BriscolaRules.js)
//
// L'engine e' agnostico rispetto al numero di giocatori (funziona anche con 3-4),
// all'ordine di ripescata e ai dettagli di punteggio: tutto cio' che e' specifico
// del gioco vive nel RuleSet, non qui.

export class TrickTakingEngine {
    constructor(players, rules) {
        this.players = players       // array di Player/HumanPlayer/AIPlayer, in ordine di turno
        this.rules = rules
        this.deck = new Deck(rules.deckConfig())
        this.rules.setupDeck?.(this.deck) // es. il taglio della briscola: vedi nota sopra
        this.trick = []              // [{playerIndex, card}] della mano corrente
        this.history = []            // mani gia' risolte: [{cards:[...], winnerIndex, points}]
        this.leaderIndex = 0         // chi e' primo di mano nella mano corrente
        this.turnIndex = 0           // chi deve giocare ora
        this.rawPoints = this.players.map(() => 0)
        this.cardsWon = this.players.map(() => 0) // per eventuali varianti di cappotto basate sulle prese
        this.lastTrickWinnerIndex = null
        this.revealed = []    // [{ownerIndex, card}] carte pescate e mostrate pubblicamente, non ancora rigiocate
        this._listeners = {}
    }

    on(event, cb) {
        (this._listeners[event] ??= []).push(cb)
        return this
    }

    emit(event, payload) {
        for (const cb of this._listeners[event] ?? []) cb(payload)
    }

    // distribuisce le carte iniziali, un giro alla volta come nella realta'
    deal() {
        const n = this.rules.handSize()
        for (let slot = 0; slot < n; slot++) {
            for (let p = 0; p < this.players.length; p++) {
                const card = this.deck.draw()
                this.players[p].receive(card, slot)
                this.emit('deal', { playerIndex: p, slot, card })
            }
        }
    }

    // vista dello stato di gioco esposta a una strategy IA.
    // Distingue due livelli di informazione, come farebbe un giocatore umano attento:
    //  - knownOpponentCards: carte che sappiamo per certo essere in mano agli
    //    avversari perche' mostrate pubblicamente in fase di pescata (vedi
    //    rules.revealsDrawnCards) e non ancora rigiocate
    //  - unseenCards: tutto il resto che non abbiamo mai visto (carte ancora
    //    nel mazzo + la parte di mano avversaria mai rivelata), utile solo
    //    per stime probabilistiche, MAI per dedurre con certezza cosa ha l'avversario
    buildView(playerIndex) {
        const me = this.players[playerIndex]
        const leadSuit = this.trick.length ? this.trick[0].card.suit : null

        const knownToMe = this.revealed.filter(r => r.ownerIndex !== playerIndex)
        const knownIds = new Set(knownToMe.map(r => r.card.id))

        const unseenCards = [...this.deck.cards]
        for (let p = 0; p < this.players.length; p++) {
            if (p === playerIndex) continue
            for (const card of this.players[p].cardsInHand())
                if (!knownIds.has(card.id)) unseenCards.push(card)
        }

        return {
            playerIndex,
            hand: me.hand,
            trick: this.trick.map(t => ({ playerIndex: t.playerIndex, card: t.card })),
            leadSuit,
            history: this.history,
            unseenCards,
            knownOpponentCards: knownToMe.map(r => ({ playerIndex: r.ownerIndex, card: r.card })),
            deckCount: this.deck.count(),
            rules: this.rules,
            engine: this, // per Marianna
        }
    }

    // il giocatore playerIndex gioca la carta in posizione slot della propria mano
    // ritorna {ok:true} oppure {ok:false, reason:'...'} se la mossa e' illegale
    playCard(playerIndex, slot) {
        if (playerIndex !== this.turnIndex) return { ok: false, reason: 'non e\' il tuo turno' }
        const player = this.players[playerIndex]
        const card = player.hand[slot]
        if (!card) return { ok: false, reason: 'slot vuoto' }
        const leadSuit = this.trick.length ? this.trick[0].card.suit : null
        if (!this.rules.isLegalPlay(player.hand, card, this.trick, leadSuit))
            return { ok: false, reason: 'mossa non consentita da regolamento' }

        player.play(slot)
        this._forgetRevealed(playerIndex, card)
        this.trick.push({ playerIndex, card, slot })
        this.emit('cardPlayed', { playerIndex, card, slot, trick: this.trick })

        if (this.trick.length === this.players.length) {
            this._resolveTrick()
        } else {
            this.turnIndex = (this.turnIndex + 1) % this.players.length
            this.emit('turnChanged', { turnIndex: this.turnIndex })
        }
        return { ok: true }
    }

    _resolveTrick() {
        const leadSuit = this.trick[0].card.suit
        const winnerRel = this.rules.trickWinner(this.trick, leadSuit) // indice relativo a this.trick[]
        const winnerIndex = this.trick[winnerRel].playerIndex
        const points = this.rules.trickPoints(this.trick)

        this.rawPoints[winnerIndex] += points
        this.cardsWon[winnerIndex] += this.trick.length
        this.lastTrickWinnerIndex = winnerIndex
        this.history.push({ cards: this.trick.map(t => t.card), winnerIndex, points })

        this.emit('trickResolved', {
            trick: this.trick, winnerIndex, points,
            rawPoints: [...this.rawPoints],
        })

        this.leaderIndex = winnerIndex
        this.turnIndex = winnerIndex
        this.trick = []

        if (this.rules.drawAfterTrick() && !this.deck.isEmpty()) {
            this._redrawAfterTrick(winnerIndex)
        } else {
            this.emit('turnChanged', { turnIndex: this.turnIndex })
            if (this.isRoundOver()) this.emit('roundOver', this.computeRoundScore())
        }
    }

    // dopo la presa, si ripesca partendo da chi ha preso, in ordine di turno
    _redrawAfterTrick(winnerIndex) {
        for (let i = 0; i < this.players.length; i++) {
            const p = (winnerIndex + i) % this.players.length
            if (this.deck.isEmpty()) break
            const card = this.deck.draw()
            const slot = this.players[p].hand.findIndex(c => c === undefined)
            const targetSlot = slot === -1 ? this.players[p].hand.length : slot
            this.players[p].receive(card, targetSlot)
            if (this.rules.revealsDrawnCards?.()) this.revealed.push({ ownerIndex: p, card })
            this.emit('draw', { playerIndex: p, slot: targetSlot, card, deckCount: this.deck.count() })
        }
        this.emit('turnChanged', { turnIndex: this.turnIndex })
        if (this.isRoundOver()) this.emit('roundOver', this.computeRoundScore())
    }

    _forgetRevealed(ownerIndex, card) {
        const i = this.revealed.findIndex(r => r.ownerIndex === ownerIndex && r.card.id === card.id)
        if (i > -1) this.revealed.splice(i, 1)
    }

    isRoundOver() {
        return this.deck.isEmpty() && this.players.every(p => p.isHandEmpty())
    }

    computeRoundScore() {
        const cfg = this.rules.deckConfig()
        return this.rules.computeRoundScore({
            rawPoints: this.rawPoints,
            cardsWon: this.cardsWon,
            lastTrickWinnerIndex: this.lastTrickWinnerIndex,
            totalCards: cfg.suits.length * cfg.ranks.length, // tutte le carte del mazzo, non solo quelle distribuite all'inizio
            players: this.players,
        })
    }

    // riavvia una nuova smazzata riusando lo stesso engine/players
    startNewHand() {
        this.deck = new Deck(this.rules.deckConfig())
        this.rules.setupDeck?.(this.deck)
        this.trick = []
        this.rawPoints = this.players.map(() => 0)
        this.cardsWon = this.players.map(() => 0)
        this.lastTrickWinnerIndex = null
        this.history = []
        this.revealed = []
        for (const p of this.players) p.hand = []
        this.leaderIndex = this.turnIndex = 0
    }
}
