import { TrickTakingEngine } from './card-engine/TrickTakingEngine.js'
import { HumanPlayer } from './card-engine/HumanPlayer.js'
import { AIPlayer } from './card-engine/AIPlayer.js'
import { BriscolaRules } from './games/briscola/BriscolaRules.js'
import { BriscolaAI } from './games/briscola/BriscolaAI.js'
import { TableRenderer } from './ui/TableRenderer.js'
import { responsiveDialogWidth } from './ui/dialogUtils.js'

const LOG_ENABLED = 0
const AI_INDEX = 0     // "PC" (0=PC, 1=umano)
const HUMAN_INDEX = 1
const TARGET_HANDS_TO_WIN = 3 // Al meglio di 5 = primo che vince 3 smazzate

class BriscolaApp {
    constructor() {
        this.rules = new BriscolaRules()
        this.handsWon = [0, 0]
        this.currentHandLeader = HUMAN_INDEX
        this.logs = []
        
        this._buildEngineAndPlayers()

        this.renderer = new TableRenderer(this.engine, {
            humanIndex: HUMAN_INDEX,
            aiIndex: AI_INDEX,
            imagePath: (id) => `./trieste/${id}.webp`,
            backImagePath: `./trieste/Dorso.webp`,
            coord: {
                // punto verso cui volano le carte vinte in una presa (fuori
                // vista, poi dissolvenza): PC in alto, Umano in basso, in
                // corrispondenza dei rispettivi badge "prese"
                pile: {
                    [AI_INDEX]: { x: 640, y: 330 },
                    [HUMAN_INDEX]: { x: 640, y: 1010 },
                },
                info: { top: 15, left: '50%', transform: 'translateX(-50%)' },
            },
            sortHand: false,
            formatInfo: (engine) => this._formatInfo(engine),
            onRoundOver: (result) => this._onRoundOver(result),
            onHelp: () => this._showHelp(),
        })

        this.renderer.preload(() => {
            this.renderer.drawDeckStack()
            this._startNewMatch()
        })
    }

    _buildEngineAndPlayers() {
        const players = [
            new AIPlayer('pc', 'PC', new BriscolaAI()),
            new HumanPlayer('human', 'Tu'),
        ]
        this.engine = new TrickTakingEngine(players, this.rules)
        this._attachEngineLogListeners()
    }

    _log(message) {
        if (!LOG_ENABLED) return;
        this.logs.push(message)
        console.log(message)
    }

    _getHandString(player) {
        const aiHand = this.engine.players[player]?.hand || []
        const validCards = aiHand.filter(Boolean)

        if (validCards.length === 0) return 'nessuna'
        return validCards.map(c => (typeof c === 'object' ? c.id : c)).join(', ')
    }

    _attachEngineLogListeners() {
        this.engine.on('cardPlayed', ({ playerIndex, card }) => {
            const cardId = typeof card === 'object' ? card.id : card
            const cardsOnTable = this.engine.trick ? this.engine.trick.length : 0

            if (cardsOnTable === 1) {
                this._log(`--- Turno ${this.engine.history.length+1}. Apre: ${playerIndex === HUMAN_INDEX ? 'Umano' : 'PC'} ---`)
            }

            if (playerIndex === AI_INDEX) {
                this._log(`PC gioca ${cardId}, ha [${this._getHandString(AI_INDEX)}]`)
            } else {
                this._log(`Umano gioca ${cardId}, ha [${this._getHandString(HUMAN_INDEX)}]`)
            }
        })

        this.engine.on('trickResolved', ({ winnerIndex, trick, points }) => {
            const winnerName = winnerIndex === HUMAN_INDEX ? 'Umano' : 'PC'
            const cardsPlayed = trick.map(item => {
                const c = item.card || item
                return typeof c === 'object' ? c.id : c
            }).join(', ')

            this._log(`-> Presa ${winnerName} (carte: [${cardsPlayed}] | punti: ${points})`)
        })
    }

    _formatInfo(engine) {
        const pc = engine.rawPoints[AI_INDEX]
        const human = engine.rawPoints[HUMAN_INDEX]
        const suitNames = { B: 'Bastoni', C: 'Coppe', D: 'Danari', S: 'Spade' }
        return [
            `Briscola: ${suitNames[this.rules.trumpSuit]}`,
            `Vittorie: TU  ${this.handsWon[HUMAN_INDEX]}   -   PC  ${this.handsWon[AI_INDEX]}`,
        ].join('\n')
    }

    /**
     * Avvia una NUOVA PARTITA da zero (Azzera smazzate e sorteggia chi inizia)
     */
    _startNewMatch() {
        this.handsWon = [0, 0]
        
        // Estrarre A CASO chi comincia la prima smazzata della partita (0=PC, 1=Umano)
        this.currentHandLeader = Math.random() < 0.5 ? AI_INDEX : HUMAN_INDEX
        
        this._startRound()
    }

    _startRound() {
        this.logs = []
        this._log("=== INIZIO NUOVA SMAZZATA ===")

        this.engine.deal()
        this.engine.turnIndex = this.currentHandLeader
        this.engine.leaderIndex = this.currentHandLeader

        const suitNames = { B: 'Bastoni', C: 'Coppe', D: 'Danari', S: 'Spade' }
        this._log(`Briscola estratta: ${this.rules.trumpSuit} (${suitNames[this.rules.trumpSuit] || 'Sconosciuto'})`)
        this._log(`Apre la smazzata: ${this.currentHandLeader === HUMAN_INDEX ? 'Umano' : 'PC'}`)
        this._log(`Mano iniziale PC: [${this._getHandString(AI_INDEX)}]`)

        this.renderer.updateInfo(this._formatInfo(this.engine))
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _onRoundOver({ scores, winnerIndex }) {
        const [pcPoints, humanPoints] = scores

        let msg = ""
        if (winnerIndex === null) {
            msg = `${pcPoints} a ${humanPoints}: pareggio!`
            this._log(`Pareggio (${pcPoints} - ${humanPoints})`)
        } else if (winnerIndex === HUMAN_INDEX) {
            this.handsWon[HUMAN_INDEX]++
            msg = `${humanPoints} a ${pcPoints}: hai vinto tu!`
            this._log(`Hai vinto! (${humanPoints} a ${pcPoints})`)
        } else {
            this.handsWon[AI_INDEX]++
            msg = `${pcPoints} a ${humanPoints}: ho vinto io!`
            this._log(`Hai perso! (${pcPoints} a ${humanPoints})`)
        }

        this._log(`Totale smazzate vinte nella partita -> PC: ${this.handsWon[AI_INDEX]}, Umano: ${this.handsWon[HUMAN_INDEX]}`)
        this._log("=== FINE SMAZZATA ===")

        if (LOG_ENABLED) this._downloadLogFile()

        // Verifica se la PARTITA è terminata (primo a 3 smazzate)
        const isMatchOver = this.handsWon[HUMAN_INDEX] >= TARGET_HANDS_TO_WIN || this.handsWon[AI_INDEX] >= TARGET_HANDS_TO_WIN

        if (isMatchOver) {
            const matchWinner = this.handsWon[HUMAN_INDEX] >= TARGET_HANDS_TO_WIN ? "HAI VINTO LA PARTITA! 🏆" : "IL PC HA VINTO LA PARTITA! 🤖"
            const finalMsg = `${msg}<br/><br/>=== ${matchWinner} ===<br/>Risultato finale: Tu ${this.handsWon[HUMAN_INDEX]} – PC ${this.handsWon[AI_INDEX]}`

            this.renderer.showMessage('Partita Conclusa!', finalMsg, () => {
                this.engine.startNewHand()
                this.renderer.reset()
                this._startNewMatch()
            })
        } else {
            msg += `<br/><br/>Smazzate vinte: Tu ${this.handsWon[HUMAN_INDEX]} – PC ${this.handsWon[AI_INDEX]}`
            
            // ALTERNA il giocatore che apre la prossima smazzata
            this.currentHandLeader = 1 - this.currentHandLeader

            this.renderer.showMessage('Risultato smazzata', msg, () => this._newHand())
        }
    }

    _downloadLogFile() {
        if (!this.logs.length) return

        const fileContent = this.logs.join('\n')
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
        const now = new Date()
        
        const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 14)
        const fileName = `log_briscola_${timestamp}.txt`

        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
    }

    _newHand() {
        this.engine.startNewHand()
        this.renderer.reset()
        this._startRound()
    }

    _showHelp() {
        fetch('aiuto_briscola.txt')
            .then(r => r.text())
            .then(html => {
                $('<div title="Regole della Briscola">').html(html).dialog({
                    modal: true, width: responsiveDialogWidth(500),
                    close: function () { $(this).dialog('destroy').remove() },
                })
            })
    }
}

function resizeGame() {
    const board = document.getElementById('game-board');
    if (!board) return;

    // Dimensioni logiche fisse del tavolo (quelle messe nel CSS)
    const GAME_WIDTH = 720;
    const GAME_HEIGHT = 1280;

    // Dimensioni reali dello schermo in questo momento
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calcoliamo il fattore di scala necessario per la larghezza e per l'altezza
    const scaleX = windowWidth / GAME_WIDTH;
    const scaleY = windowHeight / GAME_HEIGHT;

    // Prendiamo il valore più piccolo per assicurarci che il tavolo entri interamente senza tagli
    const scale = Math.min(scaleX, scaleY);

    // Applichiamo la trasformazione
    board.style.transform = `scale(${scale})`;
}

// Lancia la funzione all'avvio...
window.addEventListener('load', resizeGame);
// ...e ogni volta che la finestra cambia dimensione (es. rotazione smartphone)
window.addEventListener('resize', resizeGame);

window.partita = new BriscolaApp()