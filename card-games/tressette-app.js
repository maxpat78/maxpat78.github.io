// Questo e' l'UNICO file specifico dell'app Tressette che "sa" come collegare
// fra loro i pezzi generici (engine, player, deck) con quelli specifici del
// gioco (regole, IA) e con la UI. Per creare un'app Briscola o Marianna si
// scrive un file analogo a questo, riusando tutto cio' che sta in
// card-engine/ e (con opportune sostituzioni) lo stesso TableRenderer.

import { TrickTakingEngine } from './card-engine/TrickTakingEngine.js'
import { HumanPlayer } from './card-engine/HumanPlayer.js'
import { AIPlayer } from './card-engine/AIPlayer.js'
import { TressetteRules } from './games/tressette/TressetteRules.js'
import { TressetteAI } from './games/tressette/TressetteAI.js'
import { TableRenderer } from './ui/TableRenderer.js'

const AI_INDEX = 0     // "PC" - stessa convenzione dell'originale (0=PC, 1=umano)
const HUMAN_INDEX = 1

export class TressetteApp {
    constructor() {
        // opzioni di regolamento esposte qui per comodita': si possono cambiare
        // per adattarsi a varianti locali (vedi commenti in TressetteRules.js)
        this.rules = new TressetteRules({ followSuitRequired: true, revealDrawnCards: true })
        this.matchScores = [0, 0] // punti di partita accumulati (indice 0=PC, 1=umano)
        // chi apre la prossima smazzata: vince l'ultima presa di quella precedente
        // e apre la successiva (regola reale). Per la primissima smazzata di una
        // nuova partita non c'e' una presa precedente da cui dedurlo: apre l'umano
        // per convenzione (non essendoci un mazziere fisico da sorteggiare).
        this._nextLeader = HUMAN_INDEX
        this._buildEngineAndPlayers()

        this.renderer = new TableRenderer(this.engine, {
            humanIndex: HUMAN_INDEX,
            aiIndex: AI_INDEX,
            imagePath: (id) => `./trieste/${id}.webp`,
            backImagePath: `./trieste/Dorso.webp`,
            coord: {
                0: { x: 320, y: 1 },      // PC
                1: { x: 320, y: 585 },    // Umano
                table: { x: 410, y: 293 },
                info: { top: 565, left: 10 }, // angolo del mazzo: lontano dalla mano (che parte da x:320)
            },
            // ordina la mano dell'umano per seme/valore: facile da disattivare
            // mettendo sortHand:false, per chi preferisce l'ordine di pescata
            sortHand: true,
            handSpacing: 90,
            // per attivare lo scorrimento orizzontale (utile con mani piu' lunghe
            // di quanto entri a schermo, es. altri giochi) basta decommentare:
            // handScroll: { maxWidth: 720 },
            formatInfo: (engine) => this._formatInfo(engine),
            onRoundOver: (result) => this._onRoundOver(result),
            onHelp: () => this._showHelp(),
        })

        this.renderer.preload(() => {
            this.renderer.drawDeckStack()
            this._startRound()
        })
    }

    _buildEngineAndPlayers() {
        const players = [
            new AIPlayer('pc', 'PC', new TressetteAI()),
            new HumanPlayer('human', 'Tu'),
        ]
        this.engine = new TrickTakingEngine(players, this.rules)
    }

    // due righe compatte, senza etichette esplicite ("Smazzata"/"Partita"):
    // la prima e' il punteggio della mano in corso (col numero di carte residue
    // nel mazzo fra parentesi quadre), la seconda il punteggio di partita nel
    // formato "punteggio/21", che rende da solo intuitivo il riferimento al
    // traguardo senza bisogno di scrivere "manca" o "partita"
    _formatInfo(engine) {
        const pcRound = this.rules.formatScore(engine.rawPoints[AI_INDEX])
        const humanRound = this.rules.formatScore(engine.rawPoints[HUMAN_INDEX])
        const target = this.rules.winningScore()
        const pcMatch = this.matchScores[AI_INDEX]
        const humanMatch = this.matchScores[HUMAN_INDEX]
        return [
            `PC ${pcRound} – Tu ${humanRound}  [${engine.deck.count()}]`,
            `PC ${pcMatch}/${target} – Tu ${humanMatch}/${target}`,
        ].join('\n')
    }

    _startRound() {
        this.engine.deal()
        // chi ha vinto l'ultima presa della smazzata precedente apre quella nuova
        // (regola reale: non e' sempre l'umano ad aprire)
        this.engine.turnIndex = this._nextLeader
        this.engine.leaderIndex = this._nextLeader
        this.renderer.updateInfo(this._formatInfo(this.engine))
        // se stavolta apre il PC, va innescato a mano: TableRenderer fa partire
        // l'IA solo in risposta a un evento 'turnChanged', che qui non scatta
        // (il turno di apertura viene impostato direttamente, non con una giocata)
        if (this.engine.turnIndex === AI_INDEX) {
            setTimeout(() => this.renderer.playAiTurn(), 900)
        }
    }

    _onRoundOver({ scores, cappottoIndex }) {
        const [pcRound, humanRound] = scores
        this.matchScores[AI_INDEX] += pcRound
        this.matchScores[HUMAN_INDEX] += humanRound

        // chi ha vinto l'ultima presa apre la prossima smazzata (regola reale)
        this._nextLeader = this.engine.lastTrickWinnerIndex ?? this._nextLeader

        let msg
        if (humanRound === pcRound) msg = 'Pareggio nella smazzata!'
        else if (humanRound > pcRound) msg = `${humanRound} a ${pcRound}: hai vinto tu la smazzata!`
        else msg = `${pcRound} a ${humanRound}: ho vinto io la smazzata!`
        if (cappottoIndex !== null) msg += cappottoIndex === HUMAN_INDEX ? ' Cappotto tuo!' : ' Cappotto mio!'

        const pcOver = this.rules.isMatchWon(this.matchScores[AI_INDEX])
        const humanOver = this.rules.isMatchWon(this.matchScores[HUMAN_INDEX])
        const tied = this.matchScores[AI_INDEX] === this.matchScores[HUMAN_INDEX]
        // se entrambi hanno superato il traguardo ma sono pari, NON si dichiara
        // un vincitore: si continua con un'altra smazzata finche' uno dei due
        // non e' strettamente avanti (e' cosi' che si risolve uno spareggio)
        const matchOver = (pcOver || humanOver) && !tied

        if ((pcOver || humanOver) && tied)
            msg += `\nEntrambi a ${this.matchScores[HUMAN_INDEX]} punti-partita: si continua per decidere chi vince.`

        this.renderer.showMessage(matchOver ? 'Partita finita!' : 'Risultato smazzata', msg, () => {
            if (matchOver) {
                const winner = this.matchScores[HUMAN_INDEX] > this.matchScores[AI_INDEX] ? 'umano' : 'pc'
                this.renderer.showMessage('Partita finita!', winner === 'umano' ? 'Hai vinto la partita!' : 'Ho vinto io la partita!', () => {
                    this.matchScores = [0, 0]
                    this._nextLeader = HUMAN_INDEX // nuova partita: l'umano riapre la prima smazzata
                    this._newHand()
                })
            } else {
                this._newHand()
            }
        })
    }

    _newHand() {
        this.engine.startNewHand()
        this.renderer.reset()
        this._startRound()
    }

    _showHelp() {
        fetch('aiuto_tressette.txt')
            .then(r => r.text())
            .then(html => {
                $('<div title="Regole del Tressette">').html(html).dialog({
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
    const GAME_WIDTH = 1200;
    const GAME_HEIGHT = 900;

    // Dimensioni reali dello schermo in questo momento
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calcoliamo il fattore di scala necessario per la larghezza e per l'altezza
    const scaleX = windowWidth / GAME_WIDTH;
    const scaleY = windowHeight / GAME_HEIGHT;

    // Prendiamo il valore pi� piccolo per assicurarci che il tavolo entri interamente senza tagli
    const scale = Math.min(scaleX, scaleY);

    // Applichiamo la trasformazione
    board.style.transform = `scale(${scale})`;
}

// Lancia la funzione all'avvio...
window.addEventListener('load', resizeGame);
// ...e ogni volta che la finestra cambia dimensione (es. rotazione smartphone)
window.addEventListener('resize', resizeGame);

// avvio dell'app (equivalente a "partita = new Tavolo()" dell'originale)
window.partita = new TressetteApp()
