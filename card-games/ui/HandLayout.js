// Calcola SOLO l'ordine e la posizione orizzontale delle carte in una mano.
// Nessuna dipendenza da jQuery/DOM: e' testabile in isolamento (vedi
// tests/test-hand-layout.mjs) e riusabile per qualunque gioco di carte, non
// solo il Tressette. L'animazione vera e propria (muovere le <img> a schermo)
// resta nel renderer (TableRenderer._layoutHumanHand), che si limita a
// leggere le posizioni calcolate qui.

export class HandLayout {
    /**
     * @param {object} opts
     *   rules: ruleset del gioco (serve solo se sorted=true, per rules.strength)
     *   sorted: bool, ordina le carte per seme e poi valore (default true;
     *           puo' essere cambiato a runtime con setSorted, es. da un'opzione utente)
     *   spacing: distanza in px fra una carta e la successiva (default 90)
     *   x, y: coordinate di partenza (angolo sinistro della mano)
     */
    constructor({ rules, sorted = true, spacing = 90, x = 0, y = 0 } = {}) {
        this.rules = rules
        this.sorted = sorted
        this.spacing = spacing
        this.x = x
        this.y = y
    }

    setSorted(sorted) { this.sorted = sorted }

    // hand: array (con eventuali "buchi" undefined, tipico durante una ripescata)
    // ritorna un array di {slot, card, left, top}, uno per ogni carta presente,
    // nell'ordine in cui vanno disegnate da sinistra a destra
    layout(hand) {
        const entries = hand
            .map((card, slot) => ({ slot, card }))
            .filter(e => e.card !== undefined)

        if (this.sorted) {
            entries.sort((a, b) =>
                a.card.suit.localeCompare(b.card.suit) ||
                this.rules.strength(a.card) - this.rules.strength(b.card)
            )
        }

        return entries.map((e, i) => ({
            ...e,
            left: this.x + i * this.spacing,
            top: this.y,
        }))
    }

    // larghezza totale occupata da n carte affiancate (utile per dimensionare
    // un eventuale contenitore a scorrimento orizzontale)
    widthFor(count, cardWidth = 150) {
        return count > 0 ? (count - 1) * this.spacing + cardWidth : 0
    }
}
