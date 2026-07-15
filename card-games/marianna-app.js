import { TrickTakingEngine } from './card-engine/TrickTakingEngine.js'
import { HumanPlayer } from './card-engine/HumanPlayer.js'
import { AIPlayer } from './card-engine/AIPlayer.js'
import { MariannaRules } from './games/marianna/MariannaRules.js'
import { MariannaAI } from './games/marianna/MariannaAI.js'
import { MariannaTableRenderer } from './ui/MariannaRenderer.js'

const HUMAN_INDEX = 0
const AI_INDEX = 1

export class MariannaApp {
    constructor() {
        this.totalScores = [0, 0] // [Umano, PC]
        this.rules = new MariannaRules()
        this.logs = []
        this.currentHandLeader = HUMAN_INDEX

        const human = new HumanPlayer('human', 'Tu')
        const aiStrategy = new MariannaAI()
        const ai = new AIPlayer('pc', 'Computer', aiStrategy)

        this.players = [human, ai]
        this.engine = new TrickTakingEngine(this.players, this.rules)

        this._attachEngineLogListeners()

        this.renderer = new MariannaTableRenderer(this.engine, {
            humanIndex: HUMAN_INDEX,
            aiIndex: AI_INDEX,
            imagePath: (cardId) => `trieste/${cardId}.webp`,
            backImagePath: 'trieste/Dorso.webp',
            coord: {
                0: { x: 320, y: 585 },     // Umano
                1: { x: 320, y: 1 },       // PC
                table: { x: 410, y: 293 },  // Tavolo
                info: { top: 565, left: 10 },
            },
            sortHand: true,
            handSpacing: 90,
            formatInfo: (engine) => this._formatInfo(engine),
            onRoundOver: (result) => this._handleRoundOver(result),
            onHelp: () => this._showHelp(),
        })

        this.renderer.preload(() => {
            this._startNewMatch()
        })
    }

    _log(message) {
        this.logs.push(message)
        console.log(message)
    }

    _getHandString(playerIndex) {
        const hand = this.engine.players[playerIndex]?.hand || []
        const validCards = hand.filter(Boolean)

        if (validCards.length === 0) return 'nessuna'
        return validCards.map(c => (typeof c === 'object' ? c.id : c)).join(', ')
    }

    _attachEngineLogListeners() {
        // Tracciamento giocate
        this.engine.on('cardPlayed', ({ playerIndex, card }) => {
            const cardId = typeof card === 'object' ? card.id : card
            const cardsOnTable = this.engine.trick ? this.engine.trick.length : 0

            if (cardsOnTable === 1) {
                this._log(`--- Turno ${this.engine.history.length + 1}. Abre: ${playerIndex === HUMAN_INDEX ? 'Umano' : 'PC'} ---`)
            }

            const playerName = playerIndex === HUMAN_INDEX ? 'Umano' : 'PC'
            this._log(`${playerName} gioca ${cardId}, ha [${this._getHandString(playerIndex)}]`)
        })

        // Tracciamento risoluzione presa
        this.engine.on('trickResolved', ({ winnerIndex, trick, points }) => {
            const winnerName = winnerIndex === HUMAN_INDEX ? 'Umano' : 'PC'
            const cardsPlayed = trick.map(item => {
                const c = item.card || item
                return typeof c === 'object' ? c.id : c
            }).join(', ')

            this._log(`-> Presa ${winnerName} (carte: [${cardsPlayed}] | punti presa: ${points})`)
        })

    // Tracciamento e pop-up grafico per l'accusa delle Marianne
    if (typeof this.engine.on === 'function') {
        this.engine.on('mariannaDeclared', ({ playerIndex, suit, bonusPoints }) => {
            const isHuman = playerIndex === HUMAN_INDEX
            const playerName = isHuman ? 'Tu' : 'Il Computer'
            const suitName = this.rules.suitName ? this.rules.suitName(suit) : suit

            // 1. Log nella console / file log (per entrambi)
            this._log(`🌟 ACCUSA MARIANNA! ${playerName} accusa il seme di ${suitName} (+${bonusPoints} punti bonus! Nuova briscola)`)

            // 2. Aggiorna la barra informativa con la nuova briscola e i punti (per entrambi)
            if (this.renderer && typeof this.renderer.updateInfo === 'function') {
                this.renderer.updateInfo(this._formatInfo(this.engine))
            }

            // 3. Mostra il box di avviso SOLO per il PC
            if (!isHuman && this.renderer && typeof this.renderer.showMessage === 'function') {
                this.renderer.showMessage(
                    'Accusa del PC!',
                    `Il Computer ha dichiarato MARIANNA di ${suitName}!\n+${bonusPoints} punti bonus.\nLa nuova briscola è ${suitName}.`
                )
            }
        })
    }
}

    _formatInfo(engine) {
        const trump = this.rules.trumpSuit
            ? this.rules.suitName(this.rules.trumpSuit)
            : 'nessuna'

        return [
            `Briscola: ${trump} [Mazzo: ${engine.deck.count()}]`,
            `Punti Tu/PC: ${engine.rawPoints[HUMAN_INDEX]} (${this.totalScores[HUMAN_INDEX]}) / ${engine.rawPoints[AI_INDEX]} (${this.totalScores[AI_INDEX]})`
        ].join('\n')
    }

    _startNewMatch() {
        this.totalScores = [0, 0]
        this.currentHandLeader = Math.random() < 0.5 ? HUMAN_INDEX : AI_INDEX
        this._startRound()
    }

    _startRound() {
        this.logs = []
        this._log("=== INIZIO NUOVA SMAZZATA MARIANNA ===")

        this.renderer.reset()
        this.engine.deal()

        this.engine.turnIndex = this.currentHandLeader
        this.engine.leaderIndex = this.currentHandLeader

        const trump = this.rules.trumpSuit
            ? this.rules.suitName(this.rules.trumpSuit)
            : 'nessuna'

        this._log(`Apre la smazzata: ${this.currentHandLeader === HUMAN_INDEX ? 'Umano' : 'PC'}`)
        this._log(`Briscola iniziale: ${trump}`)
        this._log(`Mano iniziale Umano: [${this._getHandString(HUMAN_INDEX)}]`)
        this._log(`Mano iniziale PC: [${this._getHandString(AI_INDEX)}]`)

        this.renderer.updateInfo(this._formatInfo(this.engine))
        
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _handleRoundOver(result) {
        const [humanRoundPts, aiRoundPts] = result.scores
        
        this.totalScores[HUMAN_INDEX] += humanRoundPts
        this.totalScores[AI_INDEX] += aiRoundPts

        const humanTot = this.totalScores[HUMAN_INDEX]
        const aiTot = this.totalScores[AI_INDEX]
        const winScore = this.rules.winningScore()

        this._log(`RISULTATO SMAZZATA: Umano ${humanRoundPts} pt - PC ${aiRoundPts} pt`)
        this._log(`TOTALE GENERALE PARTITA: Umano ${humanTot} pt - PC ${aiTot} pt`)
        this._log("=== FINE SMAZZATA ===")

        // Download automatico del log a fine smazzata
        this._downloadLogFile()

        let msg = `Fine smazzata!\nPunti smazzata (Tu-PC): ${humanRoundPts} - ${aiRoundPts}\nPunti totali partita:\nTu: ${humanTot}\nPC: ${aiTot}`

        if (humanTot >= winScore || aiTot >= winScore) {
            let matchWinnerMsg = ""
            if (humanTot > aiTot) {
                matchWinnerMsg = "COMPLIMENTI! Hai vinto la partita superando i 500 punti! 🏆"
            } else if (aiTot > humanTot) {
                matchWinnerMsg = "Il Computer ha vinto la partita superando i 500 punti! 🤖"
            } else {
                matchWinnerMsg = "Pareggio oltre i 500 punti!"
            }

            msg += `\n\n=== ${matchWinnerMsg} ===\n\nClicca per iniziare una nuova partita.`

            this.renderer.showMessage('Partita Conclusa', msg, () => {
                this.engine.startNewHand()
                this._startNewMatch()
            })
            return
        }

        // Alterna il primo di mano per la smazzata successiva
        this.currentHandLeader = 1 - this.currentHandLeader

        this.renderer.showMessage('Smazzata Conclusa', msg, () => {
            this.engine.startNewHand()
            this._startRound()
        })
    }

    _downloadLogFile() {
        if (!this.logs.length) return

        const fileContent = this.logs.join('\n')
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
        const now = new Date()

        const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 14)
        const fileName = `log_marianna_${timestamp}.txt`

        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
    }

    _showHelp() {
        fetch('aiuto_marianna.txt')
            .then(r => r.text())
            .then(html => {
                $('<div title="Regole della Marianna">').html(html).dialog({
                    modal: true, width: 500,
                    close: function () { $(this).dialog('destroy').remove() },
                })
            })
    }

}


function resizeGame() {
    const board = document.getElementById('game-board');
    if (!board) return;

    // Dimensioni logiche fisse del tavolo (quelle messe nel CSS)
    const GAME_WIDTH = 850;
    const GAME_HEIGHT = 860;

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

// Avvio dell'app
window.partita = new MariannaApp()