const SUITS = ['B', 'C', 'D', 'S']
const RANKS = ['2', '4', '5', '6', '7', 'F', 'C', 'R', '3', 'A']
const RANK_POINTS = { '2': 0, '4': 0, '5': 0, '6': 0, '7': 0, 'F': 2, 'C': 3, 'R': 4, '3': 10, 'A': 11 }
const RANK_NAMES = { '2': 'Due', '3': 'Tre', '4': 'Quattro', '5': 'Cinque', '6': 'Sei', '7': 'Sette', 'F': 'Fante', 'C': 'Cavallo', 'R': 'Re', 'A': 'Asso' }
const SUIT_NAMES = { B: 'Bastoni', C: 'Coppe', D: 'Danari', S: 'Spade' }

export class MariannaRules {
    constructor() {
        this.trumpSuit = null         
        this.totalAccuseCount = 0    
        this.declaredSuits = new Set() // Schedula i semi per cui è GIÀ stata fatta l'accusa
    }

    deckConfig() { return { suits: SUITS, ranks: RANKS } }
    handSize() { return 5 }
    drawAfterTrick() { return true }
    revealsDrawnCards() { return false }

    setupDeck(deck) {
        this.trumpSuit = null
        this.totalAccuseCount = 0
        this.declaredSuits.clear()
    }

    strength(card) { return RANKS.indexOf(card.rank) }
    points(card) { return RANK_POINTS[card.rank] }
    cardName(card) { return `${RANK_NAMES[card.rank]} di ${SUIT_NAMES[card.suit]}` }
    suitName(suit) { return SUIT_NAMES[suit] }

    /**
     * Rileva se si può dichiarare Marianna per un dato seme:
     * 1. Il giocatore deve possedere sia Re ('R') che Cavallo ('C') di quel seme.
     * 2. Non deve essere già stata accusata la Marianna per quel seme.
     * 3. Non dobbiamo essere nelle ultime 5 carte in mano (ossia ci devono essere ancora carte nel mazzo).
     */
    canDeclareMarianna(hand, suit, deckCount = 1) {
        // Regola 1: Non si dichiara se il mazzo di pesca è esaurito (ultime 5 carte in mano)
        if (deckCount <= 0) return false

        // Regola 2: Non si dichiara se la Marianna per questo seme è già stata accusata
        if (this.declaredSuits.has(suit)) return false

        // Regola 3: Possesso simultaneo di Re e Cavallo
        const hasKing = hand.some(c => c && c.suit === suit && c.rank === 'R')
        const hasKnight = hand.some(c => c && c.suit === suit && c.rank === 'C')

        return hasKing && hasKnight
    }

    getAvailableMariannas(hand, deckCount = 1) {
        return SUITS.filter(suit => this.canDeclareMarianna(hand, suit, deckCount))
    }

    declareMarianna(playerIndex, suit, engine = null) {
        const MARIANNA_POINTS = [40, 60, 80, 100]
        const pointsIndex = Math.min(this.totalAccuseCount, MARIANNA_POINTS.length - 1)
        const bonus = MARIANNA_POINTS[pointsIndex]
        
        this.totalAccuseCount++
        this.trumpSuit = suit
        this.declaredSuits.add(suit) // Segna il seme come già accusato

        if (engine && engine.rawPoints) {
            engine.rawPoints[playerIndex] += bonus
            engine.emit('mariannaDeclared', { playerIndex, suit, bonusPoints: bonus })
        }

        return bonus
    }

    isLegalPlay(_hand, _card, _trick, _leadSuit) { return true }

    trickWinner(trick, leadSuit) {
        let bestIdx = 0
        let bestPriority = -1
        let bestStrength = -1

        trick.forEach((entry, i) => {
            const isTrump = this.trumpSuit && entry.card.suit === this.trumpSuit
            const isLead = entry.card.suit === leadSuit
            const priority = isTrump ? 2 : (isLead ? 1 : 0)
            const strength = this.strength(entry.card)

            if (priority > bestPriority || (priority === bestPriority && strength > bestStrength)) {
                bestPriority = priority
                bestStrength = strength
                bestIdx = i
            }
        })
        return bestIdx
    }

    trickPoints(trick) {
        return trick.reduce((sum, entry) => sum + this.points(entry.card), 0)
    }

    computeRoundScore({ rawPoints }) {
        return { scores: [...rawPoints] }
    }

    winningScore() { return 500 }
}