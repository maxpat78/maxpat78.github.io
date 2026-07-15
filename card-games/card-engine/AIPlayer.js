// card-engine/AIPlayer.js
import { Player } from './Player.js'

// AIPlayer NON contiene alcuna euristica di gioco: quella vive in una
// "strategy" (vedi games/tressette/TressetteAI.js) iniettata dall'esterno.
// Questo permette di riusare AIPlayer per qualunque gioco, cambiando solo la strategy.
export class AIPlayer extends Player {
    /**
     * @param {string} id
     * @param {string} name
     * @param {{chooseCardIndex: (view: object) => number}} strategy
     */
    constructor(id, name, strategy) {
        super(id, name)
        this.isHuman = false
        this.strategy = strategy
    }

    // riceve una "vista" dello stato di gioco (vedi TrickTakingEngine.buildView)
    // e ritorna l'indice, nella propria mano, della carta da giocare.
    // La vista non contiene MAI le carte in mano all'avversario: solo l'insieme
    // aggregato delle carte non ancora viste, cosi' come farebbe un giocatore umano
    // che tiene il conto delle carte uscite.
    chooseCardIndex(view) {
        return this.strategy.chooseCardIndex(view)
    }
}
