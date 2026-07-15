import { TableRenderer } from './TableRenderer.js'

export class MariannaTableRenderer extends TableRenderer {

    aiPlayStep() {
        const aiIndex = this.opts.aiIndex
        if (this.engine.currentPlayer !== aiIndex || this.engine.handEmpty()) return

        const view = {
            hand: this.engine.players[aiIndex].hand,
            trick: this.engine.trick,
            rules: this.engine.rules,
            playerIndex: aiIndex,
            deckCount: this.engine.deck ? this.engine.deck.count() : 0,
            engine: this.engine,
            renderer: this
        }

        // L'IA valuterà l'accusa, aggiornerà la grafica/log e infine sceglierà la carta
        const cardIndex = this.engine.players[aiIndex].strategy.chooseCardIndex(view)
        this.playCard(aiIndex, cardIndex)
    }

    _onHumanCardClick(playerIndex, slot) {
        if (this.attesa) return
        if (this.engine.currentPlayer !== null && 
            this.engine.currentPlayer !== undefined && 
            this.engine.currentPlayer !== playerIndex) {
            return
        }

        const player = this.engine.players[playerIndex]
        const card = player.hand[slot]
        if (!card) return

        const deckCount = this.engine.deck ? this.engine.deck.count() : 0

        // Verifica:
        // 1. È una carta Re ('R') o Cavallo ('C')
        // 2. È il primo a giocare sul banco (trick vuoto)
        // 3. canDeclareMarianna ritorna true (verifica possesso, mazzo > 0 e seme NON ancora dichiarato)
        const canAccuse = (card.rank === 'R' || card.rank === 'C') &&
            this.engine.trick.length === 0 &&
            this.engine.rules.canDeclareMarianna(player.hand, card.suit, deckCount)

        if (canAccuse) {
            this._showAccuseContextMenu(playerIndex, slot, card)
        } else {
            super._onHumanCardClick(playerIndex, slot)
        }
    }

    _showAccuseContextMenu(playerIndex, slot, card) {
        $('#marianna-menu').remove()

        const cardEl = $(`[data-slot="${slot}"][data-player="${playerIndex}"]`).length 
            ? $(`[data-slot="${slot}"][data-player="${playerIndex}"]`)
            : $(`#${card.id}`)

        const offset = cardEl.offset() || { left: window.innerWidth / 2 - 50, top: window.innerHeight - 150 }
        const suitName = this.engine.rules.suitName(card.suit)
        
        const menu$ = $(`
            <div id="marianna-menu" style="
                position: absolute;
                z-index: 9999;
                background: #ffffff;
                border: 2px solid #333;
                padding: 8px;
                border-radius: 8px;
                box-shadow: 0px 4px 10px rgba(0,0,0,0.5);
                font-family: sans-serif;
            ">
                <button id="btn-accusa" style="
                    display: block;
                    width: 100%;
                    padding: 6px 12px;
                    margin-bottom: 6px;
                    background: #2e7d32;
                    color: white;
                    font-weight: bold;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Accusa (${suitName})</button>
                <button id="btn-gioca" style="
                    display: block;
                    width: 100%;
                    padding: 6px 12px;
                    background: #e0e0e0;
                    color: #333;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Gioca direttamente ${card.id}</button>
            </div>
        `).css({
            left: offset.left,
            top: Math.max(10, offset.top - 80)
        })

        $('body').append(menu$)

        $('#btn-accusa').on('click', (e) => {
            e.stopPropagation()
            menu$.remove()
            
            // Registra l'accusa (aggiunge il seme a declaredSuits)
            this.engine.rules.declareMarianna(playerIndex, card.suit, this.engine)
            
            // Aggiorna l'interfaccia con la nuova briscola e i punti
            this.updateInfo(this.opts.formatInfo(this.engine))
        })

        $('#btn-gioca').on('click', (e) => {
            e.stopPropagation()
            menu$.remove()
            super._onHumanCardClick(playerIndex, slot)
        })

        setTimeout(() => {
            $(document).one('click', () => menu$.remove())
        }, 10)
    }
}