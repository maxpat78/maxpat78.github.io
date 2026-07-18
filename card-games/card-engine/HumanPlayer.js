import { Player } from './Player.js'

// Non aggiunge comportamento: la "decisione" di quale carta giocare arriva
// dall'esterno (click dell'utente sulla UI), non da questa classe.
// Esiste come tipo distinto per leggibilita' e per eventuali estensioni future
// (es. suggerimenti, statistiche personali, ecc.)
export class HumanPlayer extends Player {
    constructor(id, name) {
        super(id, name)
        this.isHuman = true
    }
}
