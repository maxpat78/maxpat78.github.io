// Implementa il "contratto" richiesto da TrickTakingEngine per la Briscola,
// seguendo ESATTAMENTE il testo di regole fornito (nessuna variante aggiunta
// di iniziativa: niente obbligo di seguire il seme, niente bonus ultima
// presa, niente cappotto — cose che il testo non menziona).
//
// Note di traduzione delle regole in codice:
//  - "la prima carta del mazzo e' collocata di traverso, scoperta, sotto ad
//    esso e designa il seme di briscola, ultima carta da pescare": e' l'hook
//    setupDeck(deck), chiamato dal motore subito dopo aver mescolato, PRIMA
//    di qualunque distribuzione. Taglia la prima carta, la rimette in fondo
//    al mazzo (cosi' sara' davvero l'ultima pescata) e ne memorizza il seme.
//  - "ne giocano una per prendere quella avversaria": nessun obbligo di
//    rispondere al seme (il testo non lo prevede, a differenza del Tressette).
//  - "fa presa quella piu' alta [stesso seme]; altrimenti la briscola o, in
//    mancanza, la prima": e' esattamente la logica a priorita' di
//    trickWinner (briscola > seme di chi ha aperto > nessuna delle due).
//  - "ciascuno [...] pesca una carta e gioca nuovamente": a differenza del
//    Tressette, il testo NON dice che la carta pescata viene mostrata
//    all'avversario: qui la pescata e' privata (revealsDrawnCards=false).
//  - "vince la smazzata chi fa 61 punti": il totale dei punti nel mazzo e'
//    120 (30 punti a seme x 4 semi), quindi un 60-60 e' un pareggio
//    possibile; non essendo previsto nel testo alcun punteggio di partita
//    cumulativo su piu' smazzate (a differenza del Tressette), ogni smazzata
//    e' autonoma: chi arriva a 61 vince quella smazzata.

const SUITS = ['B', 'C', 'D', 'S'] // Bastoni, Coppe, Danari, Spade
// Ordine di FORZA crescente (l'ultimo vince): 2 e' la piu' debole, Asso la piu' forte
const RANKS = ['2', '4', '5', '6', '7', 'F', 'C', 'R', '3', 'A']
// Punti per ciascun rank, nello stesso ordine di RANKS
const RANK_POINTS = { '2': 0, '4': 0, '5': 0, '6': 0, '7': 0, 'F': 2, 'C': 3, 'R': 4, '3': 10, 'A': 11 }
const RANK_NAMES = { '2': 'Due', '3': 'Tre', '4': 'Quattro', '5': 'Cinque', '6': 'Sei', '7': 'Sette', 'F': 'Fante', 'C': 'Cavallo', 'R': 'Re', 'A': 'Asso' }
const SUIT_NAMES = { B: 'Bastoni', C: 'Coppe', D: 'Danari', S: 'Spade' }

const WINNING_SCORE = 61     // punti per vincere la smazzata
const TOTAL_POINTS = 120     // somma di tutti i punti del mazzo (4 semi x 30)

export class BriscolaRules {
    constructor() {
        this.trumpSuit = null  // impostato da setupDeck() prima di ogni smazzata
        this.trumpCard = null  // la carta tagliata, per mostrarla scoperta sotto il mazzo
    }

    deckConfig() { return { suits: SUITS, ranks: RANKS } }

    handSize() { return 3 }

    drawAfterTrick() { return true }

    // a differenza del Tressette, qui la pescata NON viene mostrata
    // all'avversario (il testo non lo prevede)
    revealsDrawnCards() { return false }

    // taglia la prima carta del mazzo appena mescolato: ne designa il seme
    // come briscola, e la rimette in fondo (sara' l'ultima pescata)
    setupDeck(deck) {
        const cut = deck.cards.shift()
        deck.cards.push(cut)
        this.trumpSuit = cut.suit
        this.trumpCard = cut
    }

    strength(card) { return RANKS.indexOf(card.rank) }

    points(card) { return RANK_POINTS[card.rank] }

    cardName(card) { return `${RANK_NAMES[card.rank]} di ${SUIT_NAMES[card.suit]}` }

    suitName(card) { return SUIT_NAMES[card.suit] }

    // nessun obbligo di rispondere al seme: il testo non lo prevede
    isLegalPlay(_hand, _card, _trick, _leadSuit) { return true }

    // "fa presa quella piu' alta [stesso seme]; altrimenti la briscola o, in
    // mancanza, la prima": priorita' briscola > seme di apertura > nessuna
    // delle due; a parita' di priorita' vince la carta piu' forte
    trickWinner(trick, leadSuit) {
        let bestIdx = 0
        let bestPriority = -1
        let bestStrength = -1
        trick.forEach((entry, i) => {
            const isTrump = entry.card.suit === this.trumpSuit
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

    // niente bonus di sorta (ne' ultima presa ne' cappotto: il testo non li
    // menziona per la Briscola, a differenza del Tressette): il punteggio e'
    // semplicemente il totale dei punti presi
    computeRoundScore({ rawPoints }) {
        const scores = [...rawPoints]
        const winnerIndex = scores[0] >= WINNING_SCORE && scores[0] > scores[1] ? 0
            : scores[1] >= WINNING_SCORE && scores[1] > scores[0] ? 1
                : null // nessuno a 61, o 60-60 in pareggio
        return { scores, winnerIndex }
    }

    winningScore() { return WINNING_SCORE }

    totalPoints() { return TOTAL_POINTS }
}
