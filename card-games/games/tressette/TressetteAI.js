// Strategia euristica per il Tressette, usata da un AIPlayer (vedi card-engine/AIPlayer.js).
// Riceve solo una "view" del gioco: mano propria, carta/e sul tavolo, l'insieme
// aggregato delle carte MAI viste (utile solo per stime probabilistiche) e le
// carte che sa per certo essere in mano all'avversario perche' mostrate
// pubblicamente in pescata (view.knownOpponentCards). Non vede mai la mano
// dell'avversario direttamente.
//
// La vittoria di una mano e' sempre decisa delegando a rules.trickWinner (la
// stessa funzione usata dal motore per arbitrare davvero), cosi' IA e
// arbitraggio non possono mai discordare. Le mosse candidate sono sempre
// filtrate con rules.isLegalPlay, per rispettare l'eventuale obbligo di
// rispondere al seme calato.

export class TressetteAI {
    chooseCardIndex(view) {
        const rules = view.rules
        const leadSuit = view.leadSuit
        const candidates = view.hand
            .map((card, index) => ({ card, index }))
            .filter(c => c.card !== undefined)
            .filter(c => rules.isLegalPlay(view.hand, c.card, view.trick, leadSuit))

        if (view.trick.length === 0) return this._chooseLead(candidates, view, rules)
        return this._chooseResponse(candidates, view, rules)
    }

    // primo di mano: gioca la carta piu' "sicura" (che nessuna carta ancora in
    // gioco dello stesso seme puo' battere), preferendo fra le sicure quella
    // di maggior valore; altrimenti sacrifica la carta di minor valore.
    _chooseLead(candidates, view, rules) {
        // pool di minaccia = carte mai viste (probabilistiche) + carte note per
        // certo in mano all'avversario (mostrate in pescata): entrambe possono
        // ancora presentarsi contro la mia carta calata
        const threatPool = [...view.unseenCards, ...view.knownOpponentCards.map(k => k.card)]

        const scored = candidates.map(c => {
            const beatenBy = threatPool.filter(u =>
                u.suit === c.card.suit && rules.strength(u) > rules.strength(c.card)
            ).length
            const value = rules.points(c.card) + rules.strength(c.card)
            return { ...c, beatenBy, value }
        })

        const safe = scored.filter(c => c.beatenBy === 0)
        if (safe.length) {
            safe.sort((a, b) => b.value - a.value) // fra le sicure, gioca quella che vale di piu'
            return safe[0].index
        }

        scored.sort((a, b) => a.value - b.value) // nessuna e' sicura: minimizza il rischio
        return scored[0].index
    }

    // secondo di mano: valuta ogni carta giocabile rispetto a quella sul tavolo
    _chooseResponse(candidates, view, rules) {
        const leadCard = view.trick[0].card

        const scored = candidates.map(c => {
            const hypothetical = [
                { playerIndex: 0, card: leadCard },
                { playerIndex: 1, card: c.card },
            ]
            const winnerRel = rules.trickWinner(hypothetical, view.leadSuit)
            const wins = winnerRel === 1
            const trickPoints = rules.trickPoints(hypothetical)
            const value = rules.points(c.card) + rules.strength(c.card)
            return { ...c, wins, trickPoints, value }
        })

        const winning = scored.filter(c => c.wins)
        const losing = scored.filter(c => !c.wins)

        // 1) se posso vincere punti, lo faccio: fra le carte vincenti scelgo
        //    quella che porta piu' punti, spendendo la carta piu' debole possibile a parita' di punti
        const winningWithPoints = winning.filter(c => c.trickPoints > 0)
        if (winningWithPoints.length) {
            winningWithPoints.sort((a, b) => b.trickPoints - a.trickPoints || rules.strength(a.card) - rules.strength(b.card))
            return winningWithPoints[0].index
        }

        // 2) nessun punto in palio: se posso prendere gratis (0 punti), tanto vale
        //    farlo, cosi' guadagno la mano senza spendere nulla di prezioso
        if (winning.length) {
            winning.sort((a, b) => a.value - b.value)
            return winning[0].index
        }

        // 3) non posso vincere la mano (obbligo di seme che non ho, o le mie
        //    carte di quel seme sono tutte piu' deboli): scarto la carta che vale meno
        losing.sort((a, b) => a.value - b.value)
        return losing[0].index
    }
}
