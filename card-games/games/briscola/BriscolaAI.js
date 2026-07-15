export class BriscolaAI {
    chooseCardIndex(view) {
        const rules = view.rules
        const candidates = view.hand
            .map((card, index) => ({ card, index }))
            .filter(c => c.card !== undefined)

        if (candidates.length === 0) return 0
        if (candidates.length === 1) return candidates[0].index

        // 1. MINIMAX A FINE PARTITA (Mazzo vuoto -> risoluzione perfetta a carte note)
        if (view.deckCount === 0) {
            return this._solvePerfectEndgame(candidates, view, rules)
        }

        // 2. FASE ORDINARIA / PENULTIMO TURNO
        if (view.trick.length === 0) {
            return this._chooseLead(candidates, view, rules)
        }
        return this._chooseResponse(candidates, view, rules)
    }

    // =========================================================================
    // CALCOLO DEL VALORE DINAMICO E POTENZIALE DELLE CARTE
    // =========================================================================

    _getTrumpPotentialValue(card, view, rules) {
        const nominalPoints = rules.points(card)
        const strength = rules.strength(card)
        const pool = this._getCardPool(view)

        let maxCapturablePoints = 0
        for (const c of pool) {
            if (c.suit !== rules.trumpSuit) {
                const pts = rules.points(c)
                if (pts > maxCapturablePoints) {
                    maxCapturablePoints = pts
                }
            } else {
                if (strength > rules.strength(c)) {
                    const pts = rules.points(c)
                    if (pts > maxCapturablePoints) {
                        maxCapturablePoints = pts
                    }
                }
            }
        }

        return nominalPoints + maxCapturablePoints
    }

    _getCardPool(view) {
        const knownIds = new Set(view.knownOpponentCards.map(k => k.card.id))
        const pool = [...view.unseenCards]
        for (const k of view.knownOpponentCards) {
            pool.push(k.card)
        }
        return pool
    }

    _countThreats(card, view, rules) {
        const pool = this._getCardPool(view)
        const isTrump = card.suit === rules.trumpSuit

        return pool.filter(enemyCard => {
            const enemyIsTrump = enemyCard.suit === rules.trumpSuit
            if (!isTrump && enemyIsTrump) return true
            if (card.suit === enemyCard.suit) {
                return rules.strength(enemyCard) > rules.strength(card)
            }
            return false
        }).length
    }

    _shouldBaitForBottomTrump(view, rules) {
        if (view.deckCount !== 2 || !rules.trumpCard) return false

        const bottomTrumpVal = rules.points(rules.trumpCard)
        const bottomTrumpStr = rules.strength(rules.trumpCard)
        const pool = this._getCardPool(view)
        const remainingPointsInPool = pool.reduce((sum, c) => sum + rules.points(c), 0)

        const isHighTrump = bottomTrumpVal >= 4 || bottomTrumpStr >= 7
        return isHighTrump && remainingPointsInPool >= 12
    }

    // =========================================================================
    // APERTURA (PRIMO DI MANO)
    // =========================================================================

    _chooseLead(candidates, view, rules) {
        if (this._shouldBaitForBottomTrump(view, rules)) {
            const highValueCandidates = [...candidates].sort((a, b) => {
                const ptsDiff = rules.points(b.card) - rules.points(a.card)
                if (ptsDiff !== 0) return ptsDiff
                return rules.strength(b.card) - rules.strength(a.card)
            })
            return highValueCandidates[0].index
        }

        const safePointCards = candidates.filter(c => {
            const isNonTrump = c.card.suit !== rules.trumpSuit
            const hasPoints = rules.points(c.card) > 0
            const zeroThreats = this._countThreats(c.card, view, rules) === 0
            return isNonTrump && hasPoints && zeroThreats
        })

        if (safePointCards.length > 0) {
            safePointCards.sort((a, b) => rules.points(b.card) - rules.points(a.card))
            return safePointCards[0].index
        }

        const unsafeLoads = candidates.filter(c => 
            c.card.suit !== rules.trumpSuit && 
            rules.points(c.card) >= 10 && 
            this._countThreats(c.card, view, rules) > 0
        )
        const trumpsInHand = candidates.filter(c => c.card.suit === rules.trumpSuit)

        if (unsafeLoads.length > 0 && trumpsInHand.length >= 2) {
            trumpsInHand.sort((a, b) => {
                const potA = this._getTrumpPotentialValue(a.card, view, rules)
                const potB = this._getTrumpPotentialValue(b.card, view, rules)
                if (potA !== potB) return potA - potB
                return rules.strength(a.card) - rules.strength(b.card)
            })
            return trumpsInHand[0].index
        }

        candidates.sort((a, b) => {
            const aIsTrump = a.card.suit === rules.trumpSuit
            const bIsTrump = b.card.suit === rules.trumpSuit

            if (aIsTrump !== bIsTrump) return aIsTrump ? 1 : -1

            const ptsA = rules.points(a.card)
            const ptsB = rules.points(b.card)
            if (ptsA !== ptsB) return ptsA - ptsB

            return rules.strength(a.card) - rules.strength(b.card)
        })

        return candidates[0].index
    }

    // =========================================================================
    // RISPOSTA (SECONDO DI MANO)
    // =========================================================================

    _chooseResponse(candidates, view, rules) {
        const leadCard = view.trick[0].card
        const leadPoints = rules.points(leadCard)

        const canWin = (myCard) => {
            const myIsTrump = myCard.suit === rules.trumpSuit
            const leadIsTrump = leadCard.suit === rules.trumpSuit

            if (myIsTrump && !leadIsTrump) return true
            if (!myIsTrump && leadIsTrump) return false
            if (myCard.suit === leadCard.suit) {
                return rules.strength(myCard) > rules.strength(leadCard)
            }
            return false
        }

        const winningMoves = candidates.filter(c => canWin(c.card))
        const losingMoves = candidates.filter(c => !canWin(c.card))

        if (losingMoves.length > 0) {
            losingMoves.sort((a, b) => {
                const ptsA = rules.points(a.card)
                const ptsB = rules.points(b.card)
                if (ptsA !== ptsB) return ptsA - ptsB

                const aIsTrump = a.card.suit === rules.trumpSuit
                const bIsTrump = b.card.suit === rules.trumpSuit
                if (aIsTrump !== bIsTrump) return aIsTrump ? 1 : -1

                return rules.strength(a.card) - rules.strength(b.card)
            })
        }

        if (this._shouldBaitForBottomTrump(view, rules)) {
            if (losingMoves.length > 0) {
                return losingMoves[0].index
            }
        }

        const nonTrumpWinners = winningMoves.filter(c => c.card.suit !== rules.trumpSuit)
        if (nonTrumpWinners.length > 0) {
            nonTrumpWinners.sort((a, b) => {
                const ptsDiff = rules.points(b.card) - rules.points(a.card)
                if (ptsDiff !== 0) return ptsDiff
                return rules.strength(a.card) - rules.strength(b.card)
            })
            return nonTrumpWinners[0].index
        }

        const trumpWinners = winningMoves.filter(c => c.card.suit === rules.trumpSuit)
        if (trumpWinners.length > 0) {
            trumpWinners.sort((a, b) => {
                const potA = this._getTrumpPotentialValue(a.card, view, rules)
                const potB = this._getTrumpPotentialValue(b.card, view, rules)
                if (potA !== potB) return potA - potB
                return rules.strength(a.card) - rules.strength(b.card)
            })

            const smallestTrump = trumpWinners[0]
            const smallestTrumpPts = rules.points(smallestTrump.card)

            const opponentHasPoints = leadPoints >= 2
            const noLosingMoves = losingMoves.length === 0
            const bestLosingPts = losingMoves.length > 0 ? rules.points(losingMoves[0].card) : 0
            const wouldDonatePoints = bestLosingPts >= 2

            if (opponentHasPoints || noLosingMoves || wouldDonatePoints) {
                if (!opponentHasPoints && !noLosingMoves && smallestTrumpPts >= 10) {
                    if (bestLosingPts >= 10) {
                        return smallestTrump.index
                    }
                } else {
                    return smallestTrump.index
                }
            }
        }

        if (losingMoves.length > 0) {
            return losingMoves[0].index
        }

        return candidates[0].index
    }

    // =========================================================================
    // MINIMAX PER IL FINALE DI PARTITA (MAZZO VUOTO)
    // =========================================================================

    _solvePerfectEndgame(candidates, view, rules) {
        const myIndex = view.playerIndex
        const oppIndex = 1 - myIndex
        const myHand = candidates.map(c => c.card)
        const oppHand = this._getCardPool(view)

        let bestScore = -Infinity
        let bestCandidateIndex = candidates[0].index
        const isLead = (view.trick.length === 0)

        for (const candidate of candidates) {
            const remainingMyHand = myHand.filter(c => c.id !== candidate.card.id)
            let trick = []
            let nextIsMyTurn = false

            if (isLead) {
                trick = [{ playerIndex: myIndex, card: candidate.card }]
                nextIsMyTurn = false // Il prossimo a rispondere sulla presa è l'avversario
            } else {
                trick = [
                    { playerIndex: oppIndex, card: view.trick[0].card },
                    { playerIndex: myIndex, card: candidate.card }
                ]
                nextIsMyTurn = false // La presa è completa (2 carte) e verrà risolta subito in minimax
            }

            const score = this._minimax(
                remainingMyHand,
                oppHand,
                trick,
                nextIsMyTurn,
                rules,
                myIndex
            )

            if (score > bestScore) {
                bestScore = score
                bestCandidateIndex = candidate.index
            }
        }

        return bestCandidateIndex
    }

    _minimax(myHand, oppHand, currentTrick, isMyTurn, rules, myPlayerIndex) {
        // 1. Se la presa è completa (2 carte giocate), calcola il vincitore e assegna i punti
        if (currentTrick.length === 2) {
            const leadSuit = currentTrick[0].card.suit
            const winnerRel = rules.trickWinner(currentTrick, leadSuit)
            const winnerPlayerIndex = currentTrick[winnerRel].playerIndex
            const pts = rules.trickPoints(currentTrick)
            const scoreDelta = (winnerPlayerIndex === myPlayerIndex) ? pts : -pts

            if (myHand.length === 0 && oppHand.length === 0) {
                return scoreDelta
            }

            const nextIsMyTurn = (winnerPlayerIndex === myPlayerIndex)
            return scoreDelta + this._minimax(myHand, oppHand, [], nextIsMyTurn, rules, myPlayerIndex)
        }

        // 2. Condizione di arresto quando le mani sono vuote
        if (myHand.length === 0 && oppHand.length === 0) {
            return 0
        }

        // 3. Turno dell'IA (Massimizza il punteggio finale)
        if (isMyTurn) {
            let maxEval = -Infinity
            for (let i = 0; i < myHand.length; i++) {
                const card = myHand[i]
                const nextMyHand = myHand.filter((_, idx) => idx !== i)
                const nextTrick = [...currentTrick, { playerIndex: myPlayerIndex, card }]
                const evalVal = this._minimax(nextMyHand, oppHand, nextTrick, false, rules, myPlayerIndex)
                maxEval = Math.max(maxEval, evalVal)
            }
            return maxEval
        } 
        
        // 4. Turno dell'Avversario (Minimizza il punteggio dell'IA)
        else {
            let minEval = Infinity
            const oppPlayerIndex = 1 - myPlayerIndex
            for (let i = 0; i < oppHand.length; i++) {
                const card = oppHand[i]
                const nextOppHand = oppHand.filter((_, idx) => idx !== i)
                const nextTrick = [...currentTrick, { playerIndex: oppPlayerIndex, card }]
                const evalVal = this._minimax(myHand, nextOppHand, nextTrick, true, rules, myPlayerIndex)
                minEval = Math.min(minEval, evalVal)
            }
            return minEval
        }
    }
}