import { BriscolaAI } from '../briscola/BriscolaAI.js'

export class MariannaAI extends BriscolaAI {

    chooseCardIndex(view) {
        const rules = view.rules
        
        // 1. FILTRAGGIO SICURO: Mappa gli indici originali ed elimina gli slot vuoti (undefined)
        const candidates = view.hand
            .map((card, index) => ({ card, index }))
            .filter(c => c.card !== undefined && c.card !== null)

        if (candidates.length === 0) return 0
        if (candidates.length === 1) return candidates[0].index

        // 2. DICHIARAZIONE MARIANNA (Solo se è il primo a giocare sul banco)
        if (view.trick && view.trick.length === 0) {
            this._handleMariannaDeclarations(view)
        }

        // 3. MINIMAX A FINALE DI PARTITA (Mazzo vuoto -> risoluzione perfetta)
        if (view.deckCount === 0) {
            return this._solvePerfectEndgame(candidates, view, rules)
        }

        // 4. SCELTA DELLA CARTA IN FASE ORDINARIA
        if (view.trick && view.trick.length === 0) {
            return this._chooseLeadMarianna(candidates, view, rules)
        }
        return this._chooseResponseMarianna(candidates, view, rules)
    }

    // =========================================================================
    // DICHIARAZIONE ED ACCUSA AUTOMATICA
    // =========================================================================

    _handleMariannaDeclarations(view) {
        const rules = view.rules
        const playerIndex = view.playerIndex
        const hand = view.hand
        const deckCount = view.deckCount ?? (view.engine?.deck?.count() ?? 1)

        // Filtra le Marianne disponibili considerando possesso, mazzo > 0 e semi NON ancora accusati
        const availableMariannas = rules.getAvailableMariannas ? rules.getAvailableMariannas(hand, deckCount) : []
        
        if (availableMariannas.length > 0) {
            let suitToDeclare = availableMariannas[0]
            const nonTrumpMarianna = availableMariannas.find(s => s !== rules.trumpSuit)
            if (nonTrumpMarianna) {
                suitToDeclare = nonTrumpMarianna
            }

            // Esegue l'accusa tramite le regole passandogli l'engine
            const bonus = rules.declareMarianna(playerIndex, suitToDeclare, view.engine)
            const suitName = rules.suitName ? rules.suitName(suitToDeclare) : suitToDeclare

            console.log(`[MARIANNA AI] Il PC ha dichiarato Marianna di ${suitName} (+${bonus} pt)`)

            // Notifica la grafica e mostra il popup
            if (view.renderer) {
                if (typeof view.renderer.updateInfo === 'function' && view.renderer.opts?.formatInfo) {
                    view.renderer.updateInfo(view.renderer.opts.formatInfo(view.engine))
                }
                
                if (typeof view.renderer.showMessage === 'function') {
                    view.renderer.showMessage(
                        'Accusa del PC!', 
                        `Il Computer dichiara MARIANNA di ${suitName}!\n+${bonus} punti. La nuova briscola è ${suitName}.`
                    )
                }
            }
        }
    }

    // =========================================================================
    // EURISTICA DI APERTURA E RISPOSTA
    // =========================================================================

    _chooseLeadMarianna(candidates, view, rules) {
        const nonProtected = candidates.filter(c => !this._isProtectedMariannaPiece(c.card, view, rules))
        const choices = nonProtected.length > 0 ? nonProtected : candidates
        
        return super._chooseLead(choices, view, rules)
    }

    _chooseResponseMarianna(candidates, view, rules) {
        const leadCard = view.trick[0].card
        const leadPoints = rules.points(leadCard)

        // Se l'avversario ha caricato molta roba (Asso o Tre = 11 o 10 pt), valuta la presa anche sacrificando pezzi
        if (leadPoints >= 10) {
            return super._chooseResponse(candidates, view, rules)
        }

        // Altrimenti tenta di rispondere salvaguardando i pezzi di Marianna
        const safeCandidates = candidates.filter(c => !this._isProtectedMariannaPiece(c.card, view, rules))

        if (safeCandidates.length > 0) {
            return super._chooseResponse(safeCandidates, view, rules)
        }

        return super._chooseResponse(candidates, view, rules)
    }

    _isProtectedMariannaPiece(card, view, rules) {
        if (card.rank !== 'R' && card.rank !== 'C') return false

        // Considera solo le carte valide e presenti in mano
        const validHand = view.hand.filter(c => c !== undefined && c !== null)
        
        // 1. Coppia completa in mano -> Protezione totale prima di accusare
        const hasPairInHand = validHand.some(c => c.suit === card.suit && c.id !== card.id && (c.rank === 'R' || c.rank === 'C'))
        if (hasPairInHand) return true

        // 2. Pezzo singolo -> Protezione se ci sono ancora carte nel mazzo
        if (view.deckCount > 4) {
            const partnerRank = card.rank === 'R' ? 'C' : 'R'
            const pool = this._getCardPool(view)
            const partnerIsPossible = pool.some(c => c.suit === card.suit && c.rank === partnerRank)
            
            if (partnerIsPossible) return true
        }

        return false
    }

    _getTrumpPotentialValue(card, view, rules) {
        let basePotential = super._getTrumpPotentialValue(card, view, rules)
        if (card.rank === 'R' || card.rank === 'C') {
            basePotential += 15
        }
        return basePotential
    }
}