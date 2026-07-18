// Stesso schema di tressette-app.js/briscola-app.js: unico file che collega
// i pezzi generici (CaptureEngine, Player, Deck) con quelli specifici della
// Scopa (regole, IA, interfaccia dedicata ScopaRenderer).

import { CaptureEngine } from './card-engine/CaptureEngine.js'
import { HumanPlayer } from './card-engine/HumanPlayer.js'
import { AIPlayer } from './card-engine/AIPlayer.js'
import { ScopaRules } from './games/scopa/ScopaRules.js'
import { ScopaAI } from './games/scopa/ScopaAI.js'
import { ScopaRenderer } from './ui/ScopaRenderer.js'
import { responsiveDialogWidth } from './ui/dialogUtils.js'

const LOG_ENABLED = 0
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

            this._log(turnLog)
        })

        this.renderer = new ScopaRenderer(this.engine, {
            humanIndex: HUMAN_INDEX,
            aiIndex: AI_INDEX,
            imagePath: (id) => `./trieste/${id}.webp`,
            backImagePath: `./trieste/Dorso.webp`,
            coord: {
                human: { x: 150, y: 900 }, // Posizioni di fallback (ora gestite dinamicamente dal renderer)
                ai: { x: 270, y: 260 },
                table: { x: 110, y: 540 },
                pile: { 
                    0: { x: 640, y: 330 }, // In corrispondenza del badge PC
                    1: { x: 640, y: 1010 }  // In corrispondenza del badge Giocatore
                }, 
                info: { top: 15, left: 160 },
            },
            sortHand: true,
            formatInfo: (engine) => this._formatInfo(engine),
            onHandOver: (result) => this._onHandOver(result),
            onHelp: () => this._showHelp(),
            onOptions: () => this._showOptions(),
        })

        this.renderer.preload(() => {
            this.renderer.setDealer(this._dealerIndex)
            this.renderer.drawDeckStack() 
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

    _log(message) {
        if (!LOG_ENABLED) return
        this._history.push(message)
        console.log(message)
    }

    _formatInfo(engine) {
        const dealerName = this._dealerIndex === HUMAN_INDEX ? 'Tu' : 'PC'
        const pcScope = engine.scopeCount[AI_INDEX]
        const humanScope = engine.scopeCount[HUMAN_INDEX]
        const pcMatchScore = this.matchScores[AI_INDEX]
        const humanMatchScore = this.matchScores[HUMAN_INDEX]
        const target = this.rules.winningScore()

        const lines = [
            `PUNTI\nPC: ${pcMatchScore}/${target}   -   TU: ${humanMatchScore}/${target}`,
        ]
        const activeVariants = this._activeVariantNames()
        if (activeVariants.length) lines.push(`Varianti: ${activeVariants.join(', ')}`)
        return lines.join('\n')
    }

    _activeVariantNames() {
        const opts = this.rules.options
        const names = []
        if (opts.assoPigliatutto) names.push('Asso piglia tutto')
        if (opts.rebello) names.push('Rebello')
        if (opts.napola) names.push('Napola')
        return names
    }

    _startHand() {
        this._history = [] // Azzera il log per la nuova smazzata
        const leader = 1 - this._dealerIndex // chi non e' mazziere apre

        this._log('=== INIZIO NUOVA SMAZZATA ===')
        this._log(`Mazziere: ${this._dealerIndex === HUMAN_INDEX ? 'Umano' : 'PC'}`)
        this._log(`Apre la smazzata: ${leader === HUMAN_INDEX ? 'Umano' : 'PC'}`)
        const activeVariants = this._activeVariantNames()
        this._log(`Varianti attive: ${activeVariants.length ? activeVariants.join(', ') : 'nessuna'}`)

        this.engine.setup(leader)
        this.renderer.updateInfo(this._formatInfo(this.engine))
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _onHandOver({ scores, breakdown }) {
        this.matchScores[AI_INDEX] += scores[AI_INDEX];
        this.matchScores[HUMAN_INDEX] += scores[HUMAN_INDEX];

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
                    ${this.rules.options.rebello ? `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Rebello</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.rebello === AI_INDEX ? '✓' : ''}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.rebello === HUMAN_INDEX ? '✓' : ''}</td>
                    </tr>` : ''}
                    ${this.rules.options.napola ? `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 6px;"><strong>Napola</strong></td>
                        <td style="padding: 6px; text-align: center;">${breakdown.napola?.playerIndex === AI_INDEX ? `+${breakdown.napola.length}` : ''}</td>
                        <td style="padding: 6px; text-align: center;">${breakdown.napola?.playerIndex === HUMAN_INDEX ? `+${breakdown.napola.length}` : ''}</td>
                    </tr>` : ''}
                    <tr style="border-bottom: 2px solid #555; background-color: #eaf3ea; font-weight: bold;">
                        <td style="padding: 8px;">Punti Smazzata</td>
                        <td style="padding: 8px; text-align: center; color: green;">+${scores[AI_INDEX]}</td>
                        <td style="padding: 8px; text-align: center; color: green;">+${scores[HUMAN_INDEX]}</td>
                    </tr>
                </tbody>
            </table>
        `

        this._log('--------------------------------------------------')
        this._log(`RISULTATO SMAZZATA: PC ${scores[AI_INDEX]} - Umano ${scores[HUMAN_INDEX]}`)
        this._log(`Punteggio partita dopo questa smazzata: PC ${this.matchScores[AI_INDEX]} - Umano ${this.matchScores[HUMAN_INDEX]}`)
        this._log('=== FINE SMAZZATA ===')
        if (LOG_ENABLED) this._downloadLogFile()

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
                    winner === 'umano' ? '🎉 Hai vinto la partita!' : '💻 Ho vinto la partita!',
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

    _downloadLogFile() {
        if (!this._history.length) return

        const fileContent = this._history.join('\n')
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
        const now = new Date()

        const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 14)
        const fileName = `log_scopa_${timestamp}.txt`

        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
    }

    _newHand() {
        this.renderer.setDealer(this._dealerIndex)
        this.renderer.reset()
        this.engine.startNewHand(1 - this._dealerIndex)
        this.renderer.updateInfo(this._formatInfo(this.engine))
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _showOptions() {
        const opts = this.rules.options
        const variant = (id, checked, title, desc) => `
            <label style="display:block; margin-bottom:14px; cursor:pointer;">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="margin-right:8px; transform:scale(1.2); vertical-align:middle;">
                <strong>${title}</strong>
                <div style="margin:2px 0 0 24px; color:#555; font-size:13px;">${desc}</div>
            </label>`

        const html = `
            <div style="font-family:Arial; font-size:14px; line-height:1.4;">
                ${variant('opt-asso', opts.assoPigliatutto, 'Asso piglia tutto',
                    'Chi cala un Asso prende tutte le carte sul tavolo')}
                ${variant('opt-rebello', opts.rebello, 'Rebello',
                    'Chi ha preso il Re di Danari guadagna 1 punto')}
                ${variant('opt-napola', opts.napola, 'Napola',
                    'Chi ha preso Asso, 2 e 3 di Danari guadagna 3 punti, +1 per ogni ulteriore carta in sequenza')}
                <p style="margin:10px 0 0; color:#888; font-size:12px;">Le modifiche valgono da subito (anche per la smazzata in corso).</p>
            </div>`

        const $dialog = $(`<div title="Opzioni di gioco">`).html(html).dialog({
            modal: true, width: responsiveDialogWidth(360),
            buttons: {
                Applica: () => {
                    opts.assoPigliatutto = $('#opt-asso').is(':checked')
                    opts.rebello = $('#opt-rebello').is(':checked')
                    opts.napola = $('#opt-napola').is(':checked')
                    this.renderer.updateInfo(this._formatInfo(this.engine))
                    $dialog.dialog('close')
                },
                Annulla: function () { $(this).dialog('close') },
            },
            close: function () { $(this).dialog('destroy').remove() },
        })
    }

    _showHelp() {
        fetch('aiuto_scopa.txt')
            .then(r => r.text())
            .then(html => {
                $('<div title="Regole della Scopa">').html(html).dialog({
                    modal: true, width: responsiveDialogWidth(340),
                    close: function () { $(this).dialog('destroy').remove() },
                })
            })
    }
}

function resizeGame() {
    const board = document.getElementById('game-board');
    if (!board) return;

    // Aggiornato alle nuove dimensioni Portrait 720x1280
    const GAME_WIDTH = 720;
    const GAME_HEIGHT = 1280;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const scaleX = windowWidth / GAME_WIDTH;
    const scaleY = windowHeight / GAME_HEIGHT;

    // Adatta interamente l'area di gioco senza tagli, mantenendo le proporzioni
    const scale = Math.min(scaleX, scaleY);

    board.style.transform = `scale(${scale})`;
}

window.addEventListener('load', resizeGame);
window.addEventListener('resize', resizeGame);

window.partita = new ScopaApp()