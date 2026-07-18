// Rappresentazione generica di una carta da gioco.
// Non contiene alcuna nozione di "punti" o "forza di presa":
// quelle sono responsabilità del RuleSet del gioco specifico (vedi games/*).

export class Card {
    /**
     * @param {string} rank  simbolo del valore (es. "4","7","F","A","3" per le carte italiane,
     *                       oppure "2".."10","J","Q","K","A" per un mazzo francese)
     * @param {string} suit  simbolo del seme (es. "B","C","D","S" oppure "♠","♥",...)
     */
    constructor(rank, suit) {
        this.rank = rank
        this.suit = suit
        // id univoco e stabile, usato come chiave per grafica/DOM (es. "AB" = Asso di Bastoni)
        this.id = `${rank}${suit}`
    }

    toString() { return this.id }

    equals(other) { return !!other && this.rank === other.rank && this.suit === other.suit }
}
