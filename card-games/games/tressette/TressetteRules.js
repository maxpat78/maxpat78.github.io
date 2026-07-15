// games/tressette/TressetteRules.js
//
// Implementa il "contratto" richiesto da TrickTakingEngine per il Tressette.
//
// NOTE SUL REGOLAMENTO (esistono molte varianti locali, cfr. Wikipedia):
//  - obbligo di rispondere al seme calato per primo, se lo si possiede:
//    e' la variante piu' diffusa, quindi e' il default (followSuitRequired=true).
//    Alcune varianti regionali non lo richiedono: percio' e' un parametro del
//    costruttore, non una costante fissa nel codice.
//  - cappotto: chi realizza tutti i 10 punti di mazzo PIU' l'1 di ultima presa
//    (cioe' arriva a punteggio 11 prima del bonus) fa cappotto, anche se
//    l'avversario ha comunque effettuato prese senza valore o trattenuto
//    frazioni residue di punto (i "2/3" persi nel troncamento). Non e'
//    necessario che un giocatore prenda letteralmente tutte le 40 carte.
//  - nel gioco a due, la carta pescata dal tallone dopo ogni presa viene
//    mostrata all'avversario (vedi aiuto_tressette.txt): non e' quindi una
//    carta "ignota" nel senso probabilistico, ma nota per certo finche' non
//    viene giocata. TrickTakingEngine traccia questa informazione e la
//    espone alla IA tramite `view.knownOpponentCards` (vedi buildView).
//  - alcune varianti meridionali prevedono "accuse" di combinazioni (Napoli,
//    Bongioco...) dichiarate a inizio smazzata per punti bonus aggiuntivi:
//    non sono implementate qui, ma l'architettura si presta ad aggiungerle
//    come hook opzionale (es. `rules.detectDeclarations(hand)`), da attivare
//    su richiesta.

const SUITS = ['B', 'C', 'D', 'S'] // Bastoni, Coppe, Danari, Spade
// Ordine di FORZA crescente (l'ultimo vince): 4 e' la piu' debole, 3 la piu' forte
const RANKS = ['4', '5', '6', '7', 'F', 'C', 'R', 'A', '2', '3']
// Punti in "terzi" per ciascun rank, nello stesso ordine di RANKS
const RANK_POINTS = { '4': 0, '5': 0, '6': 0, '7': 0, 'F': 1, 'C': 1, 'R': 1, 'A': 3, '2': 1, '3': 1 }
const RANK_NAMES = { '4': 'Quattro', '5': 'Cinque', '6': 'Sei', '7': 'Sette', 'F': 'Fante', 'C': 'Cavallo', 'R': 'Re', 'A': 'Asso', '2': 'Due', '3': 'Tre' }
const SUIT_NAMES = { B: 'Bastoni', C: 'Coppe', D: 'Danari', S: 'Spade' }

const WINNING_SCORE = 21
const CAPPOTTO_THRESHOLD = 11 // 10 punti di mazzo (troncati) + 1 di ultima presa

export class TressetteRules {
    /**
     * @param {object} opts
     *   followSuitRequired: obbligo di rispondere al seme calato, se posseduto (default: true)
     *   revealDrawnCards: la carta pescata dal tallone viene mostrata all'avversario (default: true, gioco a 2)
     */
    constructor({ followSuitRequired = true, revealDrawnCards = true } = {}) {
        this.followSuitRequired = followSuitRequired
        this._revealDrawnCards = revealDrawnCards
    }

    deckConfig() { return { suits: SUITS, ranks: RANKS } }

    handSize() { return 10 }

    drawAfterTrick() { return true }

    // vedi nota in cima al file: nel gioco a 2 la pescata e' pubblica
    revealsDrawnCards() { return this._revealDrawnCards }

    // forza di presa: posizione nell'ordinamento RANKS (piu' alto = piu' forte)
    strength(card) { return RANKS.indexOf(card.rank) }

    points(card) { return RANK_POINTS[card.rank] }

    cardName(card) { return `${RANK_NAMES[card.rank]} di ${SUIT_NAMES[card.suit]}` }

    suitName(card) { return SUIT_NAMES[card.suit] }

    // se si possiede almeno una carta del seme calato, e' obbligatorio giocarne una
    // (salvo che la regola sia disattivata via costruttore per una variante locale)
    isLegalPlay(hand, card, trick, leadSuit) {
        if (!this.followSuitRequired) return true
        if (trick.length === 0) return true // chi apre la mano puo' calare qualunque carta
        if (card.suit === leadSuit) return true
        const hasLeadSuit = hand.some(c => c && c.suit === leadSuit)
        return !hasLeadSuit // se non ho il seme richiesto, sono libero
    }

    // ritorna l'indice (relativo a trick[]) del vincitore della mano.
    // Regola: vince la carta piu' forte fra quelle giocate nello stesso seme
    // di chi ha aperto la mano; le carte di seme diverso non possono mai vincere
    // (questo vale sia con sia senza obbligo di rispondere a seme).
    trickWinner(trick, leadSuit) {
        let bestIdx = 0
        let bestStrength = -1
        trick.forEach((entry, i) => {
            if (entry.card.suit !== leadSuit) return
            const s = this.strength(entry.card)
            if (s > bestStrength) { bestStrength = s; bestIdx = i }
        })
        return bestIdx
    }

    trickPoints(trick) {
        return trick.reduce((sum, entry) => sum + this.points(entry.card), 0)
    }

    // calcola il punteggio finale della smazzata, con bonus ultima presa e cappotto.
    // Il cappotto si basa sul punteggio pieno (10+1=11), non sul numero di carte
    // fisicamente prese: un giocatore puo' fare cappotto anche se l'avversario
    // ha comunque intascato qualche presa senza valore (4,5,6,7) o una frazione
    // residua di punto persa nel troncamento.
    computeRoundScore({ rawPoints, lastTrickWinnerIndex }) {
        const scores = rawPoints.map(p => Math.trunc(p / 3))
        if (lastTrickWinnerIndex !== null) scores[lastTrickWinnerIndex] += 1

        let cappottoIndex = null
        scores.forEach((s, i) => {
            if (s === CAPPOTTO_THRESHOLD) { scores[i] += 6; cappottoIndex = i }
        })

        return { scores, cappottoIndex }
    }

    isMatchWon(totalScore) { return totalScore >= WINNING_SCORE }

    winningScore() { return WINNING_SCORE }

    // formattazione "elegante" del punteggio di una smazzata in corso: niente
    // decimali, le frazioni di punto si scrivono con i simboli ⅓/⅔ come si fa
    // a mano nel gioco reale (es. "6⅔" invece di "6.7")
    formatScore(rawPoints) {
        const whole = Math.trunc(rawPoints / 3)
        const rem = rawPoints % 3
        if (rem === 0) return `${whole}`
        return rem === 1 ? `${whole}⅓` : `${whole}⅔`
    }
}
