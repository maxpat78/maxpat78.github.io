// Stesso schema di tressette-app.js/briscola-app.js: unico file che collega
// i pezzi generici (CaptureEngine, Player, Deck) con quelli specifici della
// Scopa (regole, IA, interfaccia dedicata ScopaRenderer).

import { CaptureEngine } from './card-engine/CaptureEngine.js'
import { HumanPlayer } from './card-engine/HumanPlayer.js'
import { AIPlayer } from './card-engine/AIPlayer.js'
import { ScopaRules } from './games/scopa/ScopaRules.js'
import { ScopaAI } from './games/scopa/ScopaAI.js'
import { ScopaRenderer } from './ui/ScopaRenderer.js'

const AI_INDEX = 0     // "PC" - stessa convenzione degli altri giochi (0=PC, 1=umano)
const HUMAN_INDEX = 1

class ScopaApp {
    constructor() {
        this.rules = new ScopaRules()
        this.matchScores = [0, 0]
        this._dealerIndex = AI_INDEX
        this._buildEngineAndPlayers()

        // ── Log dettagliato delle mosse e del tavolo ───────────────────────
        this._history = [] // Memorizza la cronologia della smazzata corrente
        
        this.engine.on('cardPlayed', ({ playerIndex, card, captured, isScopa }) => {
            const playerName = this.engine.players[playerIndex].name
            
            // 1. Tavolo PRIMA della mossa:
            let tableBefore = [...this.engine.table]
            if (captured.length > 0) {
                tableBefore.push(...captured)
            } else {
                tableBefore = tableBefore.filter(c => c.id !== card.id)
            }
            const tableBeforeStr = tableBefore.length 
                ? tableBefore.map(c => c.id).join(', ') 
                : 'VUOTO'

            // 2. Descrizione dell'azione:
            const capText = captured.length 
                ? `PRENDE [${captured.map(c => c.id).join(', ')}]` 
                : 'SCARTA sul tavolo'
            const scopaText = isScopa ? ' 🌟 SCOPA!' : ''

            // 3. Tavolo DOPO la mossa:
            const tableAfterStr = this.engine.table.length 
                ? this.engine.table.map(c => c.id).join(', ') 
                : 'VUOTO'

            // Costruzione del blocco di testo per il turno
            const turnLog = [
                `--------------------------------------------------`,
                `👤 Turno: ${playerName}`,
                `   Tavolo Prima : [${tableBeforeStr}]`,
                `   Mossa        : Gioca ${card.id} -> ${capText}${scopaText}`,
                `   Tavolo Dopo  : [${tableAfterStr}]`
            ].join('\n')

            console.log(turnLog)
            this._history.push(turnLog)
        })

        this.renderer = new ScopaRenderer(this.engine, {
            humanIndex: HUMAN_INDEX,
            aiIndex: AI_INDEX,
            imagePath: (id) => `../trieste/${id}.webp`,
            backImagePath: `../trieste/Dorso.webp`,
            coord: {
                human: { x: 320, y: 585 },
                ai: { x: 320, y: 1 },
                table: { x: 320, y: 293 },
                pile: { 0: { x: 1050, y: 1 }, 1: { x: 1050, y: 585 } }, // indicatore prese, non un mazzetto simulato
                info: { top: 565, left: 10 },
            },
            sortHand: true,
            formatInfo: (engine) => this._formatInfo(engine),
            onHandOver: (result) => this._onHandOver(result),
            onHelp: () => this._showHelp(),
        })

        this.renderer.preload(() => {
            this.renderer.drawDeckStack() // mostra anche la briscola tagliata sotto il mazzo (vedi TableRenderer.drawDeckStack)
            this._startHand()
        })
    }

    _buildEngineAndPlayers() {
        const players = [
            new AIPlayer('pc', 'PC', new ScopaAI()),
            new HumanPlayer('human', 'Tu'),
        ]
        this.engine = new CaptureEngine(players, this.rules)
    }

    _formatInfo(engine) {
        const dealerName = this._dealerIndex === HUMAN_INDEX ? 'Tu' : 'PC'
        const pcScope = engine.scopeCount[AI_INDEX]
        const humanScope = engine.scopeCount[HUMAN_INDEX]
        const pcMatchScore = this.matchScores[AI_INDEX]
        const humanMatchScore = this.matchScores[HUMAN_INDEX]
        const target = this.rules.winningScore()

        return [
            `Mazziere: ${dealerName}  |  Scope (PC/Tu): ${pcScope} - ${humanScope}`,
            `Punti (PC/Tu): ${pcMatchScore}/${target} - ${humanMatchScore}/${target}`
        ].join('\n')
    }

    _startHand() {
        this._history = [] // Azzera il log per la nuova smazzata
        const leader = 1 - this._dealerIndex // chi non e' mazziere apre
        this.engine.setup(leader)
        this.renderer.updateInfo(this._formatInfo(this.engine))
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _onHandOver({ scores, breakdown }) {
        const fileContent = [
            `=== RESOCONTO SMAZZATA ===`,
            `Risultato: PC +${scores[AI_INDEX]} - Tu +${scores[HUMAN_INDEX]}`,
            `-----------------------------------`,
            ...this._history
        ].join('\n')

        this.matchScores[AI_INDEX] += scores[AI_INDEX]
        this.matchScores[HUMAN_INDEX] += scores[HUMAN_INDEX]

        const htmlTable = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-family: Arial, sans-serif;">
                <thead>
                    <tr style="border-bottom: 2px solid #555; background-color: #f2f2f2; text-align: left;">
                        <th style="padding: 6px;">Voce</th>
                        <th style="padding: 6px; text-align: center;">PC</th>
                        <th style="padding: 6px; text-align: center;">Tu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Carte</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.cardCount[0]}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.cardCount[1]}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Denari</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.denariCount[0]}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.denariCount[1]}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Primiera</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.primieraScores[0]}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.primieraScores[1]}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Settebello</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.settebello === AI_INDEX ? '✓' : ''}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.settebello === HUMAN_INDEX ? '✓' : ''}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Scope</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.scope[0]}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.scope[1]}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #555; background-color: #eaf3ea; font-weight: bold;">
                        <td style="padding: 8px;">Punti Smazzata</td>
                        <td style="padding: 8px; text-align: center; color: green;">+${scores[AI_INDEX]}</td>
                        <td style="padding: 8px; text-align: center; color: green;">+${scores[HUMAN_INDEX]}</td>
                    </tr>
                </tbody>
            </table>
        `

        const pcOver = this.rules.isMatchWon(this.matchScores[AI_INDEX])
        const humanOver = this.rules.isMatchWon(this.matchScores[HUMAN_INDEX])
        const tied = this.matchScores[AI_INDEX] === this.matchScores[HUMAN_INDEX]
        const matchOver = (pcOver || humanOver) && !tied

        let note = ''
        if ((pcOver || humanOver) && tied) {
            note = `<p style="margin-top: 10px; color: orange;"><strong>Pareggio a ${this.matchScores[HUMAN_INDEX]} punti-partita:</strong> si continua per decidere.</p>`
        }

        this.renderer.showMessage('Risultato smazzata', htmlTable + note, () => {
            this._dealerIndex = 1 - this._dealerIndex
            if (matchOver) {
                const winner = this.matchScores[HUMAN_INDEX] > this.matchScores[AI_INDEX] ? 'umano' : 'pc'
                this.renderer.showMessage(
                    'Partita finita!',
                    winner === 'umano' ? '🎉 Hai vinto la partita!' : '💻 Ho vinto io la partita!',
                    () => {
                        this.matchScores = [0, 0]
                        this._dealerIndex = AI_INDEX
                        this._newHand()
                    }
                )
            } else {
                this._newHand()
            }
        })
    }

    _newHand() {
        this.renderer.reset()
        this.engine.startNewHand(1 - this._dealerIndex)
        this.renderer.updateInfo(this._formatInfo(this.engine))
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _showHelp() {
        fetch('aiuto_scopa.txt')
            .then(r => r.text())
            .then(html => {
                $('<div title="Regole della Scopa">').html(html).dialog({
                    modal: true, width: 500,
                    close: function () { $(this).dialog('destroy').remove() },
                })
            })
    }

    _downloadLog(filename, text) {
        const element = document.createElement('a')
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
        element.setAttribute('download', filename)
        element.style.display = 'none'
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
    }
}

function resizeGame() {
    const board = document.getElementById('game-board');
    if (!board) return;

    // Dimensioni logiche fisse del tavolo (quelle messe nel CSS)
    const GAME_WIDTH = 1200;
    const GAME_HEIGHT = 900;

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

window.partita = new ScopaApp()
