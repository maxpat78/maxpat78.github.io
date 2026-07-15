// card-engine/Deck.js
import { Card } from './Card.js'

// Mescolamento Fisher-Yates: l'unico algoritmo che garantisce una
// permutazione uniforme. Il vecchio `sort(() => 0.5 - Math.random())`
// è un bias noto e va evitato sempre.
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
}

export class Deck {
    /**
     * @param {{suits: string[], ranks: string[]}} config
     *        suits/ranks definiscono la composizione del mazzo (40 carte italiane,
     *        52 carte francesi, mazzo con jolly, ecc: è il gioco specifico a deciderlo).
     */
    constructor(config) {
        this.config = config
        this.cards = []
        for (const suit of config.suits)
            for (const rank of config.ranks)
                this.cards.push(new Card(rank, suit))
        shuffle(this.cards)
    }

    draw() { return this.cards.shift() }

    isEmpty() { return this.cards.length === 0 }

    count() { return this.cards.length }
}
