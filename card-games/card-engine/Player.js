// Player e' solo un contenitore di mano + identita'. Non sa nulla di
// regole di presa/punteggio (quello e' nel RuleSet) ne' di grafica (quello e' nella UI).

export class Player {
    /**
     * @param {string} id     identificativo interno stabile (es. "pc", "human", "north"...)
     * @param {string} name   nome visualizzabile
     */
    constructor(id, name) {
        this.id = id
        this.name = name
        this.hand = [] // array di Card; puo' contenere "buchi" (undefined) in attesa di ripescata
    }

    // inserisce una carta in uno slot della mano (se slot e' omesso, nel primo libero/append)
    receive(card, slot) {
        if (slot === undefined) slot = this.hand.length
        this.hand[slot] = card
        return slot
    }

    // rimuove e ritorna la carta in una posizione, lasciando un buco
    play(slot) {
        const card = this.hand[slot]
        this.hand[slot] = undefined
        return card
    }

    cardsInHand() { return this.hand.filter(c => c !== undefined) }

    hasSuit(suit) { return this.hand.some(c => c && c.suit === suit) }

    isHandEmpty() { return this.cardsInHand().length === 0 }
}
