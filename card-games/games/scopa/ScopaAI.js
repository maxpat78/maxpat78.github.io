// Strategia euristica per la Scopa. Diversa nella struttura dalle IA di
// Tressette/Briscola (games/tressette/TressetteAI.js, games/briscola/BriscolaAI.js):
// li' si sceglieva SOLO quale carta giocare; qui bisogna scegliere sia quale
// carta giocare SIA quale combinazione di presa effettuare (quando ce n'e'
// piu' di una disponibile), e valutare esplicitamente quanto una mossa
// espone l'avversario alla mossa successiva, dato che il tavolo resta
// visibile e "attaccabile" per piu' turni (non e' un confronto immediato
// come nei giochi a prese classici).
//
// Riceve una "view" (vedi CaptureEngine.buildView): mano propria, tavolo
// pubblico, insieme aggregato delle carte non ancora viste (mazzo + mano
// avversaria, indistinguibili). Non vede mai la mano dell'avversario.

const DENARI_SUIT = 'D'

export class ScopaAI {
    /**
     * @returns {{slot:number, capture: Card[]|null}}
     */
    chooseMove(view) {
        const rules = view.rules
        const hand = view.hand
            .map((card, slot) => ({ card, slot }))
            .filter(c => c.card !== undefined)

        // per ogni carta in mano, elenca ogni mossa possibile: o una delle
        // combinazioni di presa valide, o (se nessuna presa e' possibile)
        // il semplice scarto sul tavolo
        const moves = []
        for (const { card, slot } of hand) {
            const captures = rules.findCaptures(card, view.table)
            if (captures.length === 0) {
                moves.push({ slot, card, capture: null, isScopa: false })
            } else {
                for (const capture of captures) {
                    moves.push({ slot, card, capture, isScopa: capture.length === view.table.length })
                }
            }
        }

        // 1) una scopa e' SEMPRE conveniente (punto garantito, nessun
        //    rischio: il tavolo resta comunque vuoto dopo). Fra piu' scope
        //    possibili, quella che porta via il maggior valore. Con "asso
        //    piglia tutto" attivo, un Asso calato su tavolo non vuoto e'
        //    SEMPRE una scopa (findCaptures lo fa gia' coincidere con
        //    l'intero tavolo): finisce qui automaticamente, senza bisogno di
        //    logica dedicata.
        const scopas = moves.filter(m => m.isScopa)
        if (scopas.length) {
            scopas.sort((a, b) =>
                this._captureValue([b.card, ...b.capture], rules, view.capturedCards) -
                this._captureValue([a.card, ...a.capture], rules, view.capturedCards))
            return scopas[0]
        }

        // 2) fra le prese non-scopa, valuta guadagno immediato MENO il
        //    rischio che il tavolo risultante lascia all'avversario
        const captures = moves.filter(m => m.capture)
        if (captures.length) {
            const scored = captures.map(m => {
                const gain = this._captureValue([m.card, ...m.capture], rules, view.capturedCards)
                const remainingTable = view.table.filter(c => !m.capture.some(x => x.id === c.id))
                const risk = this._opponentRisk(remainingTable, view, rules)
                return { ...m, score: gain - risk }
            })
            scored.sort((a, b) => b.score - a.score)
            return scored[0]
        }

        // 3) nessuna presa possibile con nessuna carta: scarta quella che
        //    espone meno l'avversario (aggiunta al tavolo) e che varrebbe
        //    meno se dovesse comunque essere presa in futuro
        const discards = moves.map(m => {
            const hypotheticalTable = [...view.table, m.card]
            const risk = this._opponentRisk(hypotheticalTable, view, rules)
            let cost = this._captureValue([m.card], rules, view.capturedCards)
            // "asso piglia tutto": un Asso in mano e' un potenziale scopone
            // futuro (basta aspettare che il tavolo si riempia), quindi va
            // scartato solo se non c'e' alternativa migliore in mano
            if (rules.assoPigliattuttoEnabled?.() && m.card.rank === 'A') cost += 8
            return { ...m, score: -(risk + cost) }
        })
        discards.sort((a, b) => b.score - a.score)
        return discards[0]
    }

    // valore "strategico" di un insieme di carte (giocata + eventuale presa):
    // pesa le carte in base a cosa contano per il punteggio di fine smazzata.
    // alreadyCaptured (opzionale): il resto delle carte gia' catturate dal
    // giocatore in questa smazzata, usato SOLO per valutare l'avanzamento
    // della sequenza "napola" (che dipende da cosa si ha gia' in pila, non
    // solo da questa singola presa). Quando manca (es. nella stima del
    // rischio per l'avversario, la cui pila non e' visibile), si valuta la
    // presa come se fosse isolata: un'approssimazione prudente, non un
    // errore, dato che comunque segnala il rischio di una tripletta
    // catturata tutta in un colpo.
    _captureValue(cards, rules, alreadyCaptured = []) {
        let v = 0
        for (const c of cards) {
            v += 1                                    // ogni carta conta per il conteggio "carte"
            if (c.suit === DENARI_SUIT) v += 2         // "denari" pesa nel conteggio di quel seme
            if (rules.isSettebello(c)) v += 12         // il settebello e' un punto quasi sempre conteso
            if (rules.rebelloEnabled?.() && rules.isRebello(c)) v += 12 // stesso peso del settebello
            v += rules.primieraValue(c) / 3            // contributo proporzionale al valore da primiera
        }
        if (rules.napolaEnabled?.()) {
            const before = rules.napolaLength(alreadyCaptured)
            const after = rules.napolaLength([...alreadyCaptured, ...cards])
            if (after > before) v += (after - before) * 6 // ogni punto di napola vale quanto mezza scopa
        }
        return v
    }

    // quanto e' "pericoloso" per l'avversario un certo stato del tavolo: per
    // un campione delle carte non ancora viste (mazzo + mano avversaria,
    // indistinguibili dal nostro punto di vista), calcola il valore atteso
    // di presa che otterrebbero contro QUESTO tavolo, mediato sul campione
    _opponentRisk(table, view, rules) {
        if (table.length === 0) return 0 // tavolo vuoto: l'avversario non puo' catturare nulla al prossimo turno
        const pool = view.unseenCards
        if (pool.length === 0) return 0
        const sample = pool.slice(0, Math.min(pool.length, 12)) // limite di calcolo
        let risk = 0
        for (const card of sample) {
            const captures = rules.findCaptures(card, table)
            for (const capture of captures) {
                const isScopa = capture.length === table.length
                const value = this._captureValue([card, ...capture], rules) + (isScopa ? 8 : 0) // una scopa avversaria pesa di piu'
                risk += value / sample.length
            }
        }
        return risk
    }
}
