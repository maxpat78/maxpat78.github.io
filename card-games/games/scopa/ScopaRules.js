// games/scopa/ScopaRules.js
//
// Implementa il contratto richiesto da CaptureEngine per la Scopa, secondo
// le regole fornite. Stesso mazzo triestino gia' usato per Tressette/Briscola
// (suits B,C,D,S), qui pero' il "valore" di una carta serve per l'abbinamento
// (Asso=1 ... Re=10), non per stabilire chi e' piu' forte.

const SUITS = ['B', 'C', 'D', 'S'] // Bastoni, Coppe, Danari (Denari), Spade
const RANKS = ['A', '2', '3', '4', '5', '6', '7', 'F', 'C', 'R']
const FACE_VALUE = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, F: 8, C: 9, R: 10 }
// punteggio "alla Stoppa" per la Primiera: le figure valgono meno di un 7 o un Asso
const PRIMIERA_VALUE = { A: 16, '2': 12, '3': 13, '4': 14, '5': 15, '6': 18, '7': 21, F: 10, C: 10, R: 10 }
const RANK_NAMES = { A: 'Asso', '2': 'Due', '3': 'Tre', '4': 'Quattro', '5': 'Cinque', '6': 'Sei', '7': 'Sette', F: 'Fante', C: 'Cavallo', R: 'Re' }
const SUIT_NAMES = { B: 'Bastoni', C: 'Coppe', D: 'Denari', S: 'Spade' }

const WINNING_SCORE = 21
const DENARI_SUIT = 'D'
const SETTEBELLO = { rank: '7', suit: 'D' }

export class ScopaRules {
    deckConfig() { return { suits: SUITS, ranks: RANKS } }

    handSize() { return 3 }

    tableSize() { return 4 }

    faceValue(card) { return FACE_VALUE[card.rank] }

    // HandLayout (riusato per il ventaglio della mano) ordina le carte
    // tramite rules.strength(): qui non c'e' un concetto di "forza di presa"
    // come in Tressette/Briscola, quindi usiamo semplicemente il valore
    // facciale, che e' comunque un ordinamento sensato per la mano
    strength(card) { return this.faceValue(card) }

    primieraValue(card) { return PRIMIERA_VALUE[card.rank] }

    cardName(card) { return `${RANK_NAMES[card.rank]} di ${SUIT_NAMES[card.suit]}` }

    suitName(card) { return SUIT_NAMES[card.suit] }

    isSettebello(card) { return card.rank === SETTEBELLO.rank && card.suit === SETTEBELLO.suit }

    // "c'e' una carta di identico valore facciale o, in mancanza, vi sono
    // piu' carte che, sommate, eguagliano tale valore": la corrispondenza
    // singola ha SEMPRE priorita' sulla somma, non vanno mai mescolate.
    // Ritorna un array di combinazioni valide (ognuna un sottoinsieme del
    // tavolo); array vuoto se non c'e' alcuna presa possibile.
    findCaptures(playedCard, table) {
        const v = this.faceValue(playedCard)

        const singles = table.filter(c => this.faceValue(c) === v)
        if (singles.length) return singles.map(c => [c])

        // nessuna corrispondenza singola: cerca tutte le combinazioni (di
        // almeno 2 carte) che sommate raggiungono v. Forza bruta sui
        // sottoinsiemi: il tavolo resta quasi sempre piccolo (poche decine di
        // carte al massimo), quindi e' rapido; un limite di sicurezza evita
        // un'esplosione combinatoria in casi patologici.
        if (table.length > 20) return []
        const sums = []
        const n = table.length
        for (let mask = 1; mask < (1 << n); mask++) {
            if (this._popcount(mask) < 2) continue
            let sum = 0
            const subset = []
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) { sum += this.faceValue(table[i]); subset.push(table[i]) }
            }
            if (sum === v) sums.push(subset)
        }
        return sums
    }

    _popcount(mask) {
        let c = 0
        while (mask) { c += mask & 1; mask >>= 1 }
        return c
    }

    // punteggio di fine smazzata: 1 punto per ciascun obiettivo raggiunto,
    // piu' 1 punto per ciascuna scopa fatta
    computeHandScore({ capturedCards, scopeCount }) {
        const scores = [0, 0]
        scores[0] += scopeCount[0]
        scores[1] += scopeCount[1]

        const has7D = i => capturedCards[i].some(c => this.isSettebello(c))
        const settebello = has7D(0) ? 0 : has7D(1) ? 1 : null
        if (settebello !== null) scores[settebello]++

        const cardCount = capturedCards.map(cs => cs.length)
        const carte = cardCount[0] > cardCount[1] ? 0 : cardCount[1] > cardCount[0] ? 1 : null
        if (carte !== null) scores[carte]++

        const denariCount = capturedCards.map(cs => cs.filter(c => c.suit === DENARI_SUIT).length)
        const denari = denariCount[0] > denariCount[1] ? 0 : denariCount[1] > denariCount[0] ? 1 : null
        if (denari !== null) scores[denari]++

        const primieraTotal = cs => {
            let total = 0
            for (const suit of SUITS) {
                const inSuit = cs.filter(c => c.suit === suit)
                if (inSuit.length) total += Math.max(...inSuit.map(c => this.primieraValue(c)))
            }
            return total
        }
        const primieraScores = capturedCards.map(primieraTotal)
        const primiera = primieraScores[0] > primieraScores[1] ? 0 : primieraScores[1] > primieraScores[0] ? 1 : null
        if (primiera !== null) scores[primiera]++

        return {
            scores,
            breakdown: {
                scope: [...scopeCount],
                settebello, carte, denari, primiera,
                cardCount, denariCount, primieraScores,
            },
        }
    }

    isMatchWon(totalScore) { return totalScore >= WINNING_SCORE }

    winningScore() { return WINNING_SCORE }
}
