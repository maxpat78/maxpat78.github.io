import { HandLayout } from './HandLayout.js'
import { responsiveDialogWidth } from './dialogUtils.js'

export class ScopaRenderer {
    constructor(engine, opts) {
        this.engine = engine
        this.opts = opts

        this._aiHandBack = {}     // { slot: backElementId } - dorsi in mano all'IA
        this._backCounter = this._totalDeckSize()
        this._dealerIndex = null  // impostato da setDealer() prima di ogni smazzata

        this._selectedSlot = null       // slot in mano umana attualmente scelto per la mossa
        this._pendingOptions = []       // combinazioni di presa legali per quella carta
        this._selectedTableIds = new Set()

        this.handLayout = new HandLayout({
            rules: engine.rules,
            sorted: opts.sortHand !== false,
            spacing: opts.handSpacing || 120,
            x: opts.coord.human.x,
            y: opts.coord.human.y,
        })
        this.tableLayout = new HandLayout({
            rules: engine.rules,
            sorted: false,
            spacing: opts.tableSpacing || 115,
            x: opts.coord.table.x,
            y: opts.coord.table.y,
        })

        this._bindEngineEvents()
    }

    _totalDeckSize() {
        const cfg = this.engine.rules.deckConfig()
        return cfg.suits.length * cfg.ranks.length
    }

    // chiamato dall'app prima di ogni smazzata: il mazzo da cui si pesca va
    // disegnato dalla parte di chi distribuisce (come nella realta', il
    // mazziere se lo tiene davanti), non a meta' strada fra i due giocatori
    setDealer(dealerIndex) { this._dealerIndex = dealerIndex }

    _deckBaseY() {
        if (this._dealerIndex === this.opts.aiIndex) return this.opts.coord.ai.y
        if (this._dealerIndex === this.opts.humanIndex) return this.opts.coord.human.y
        return 560 // mazziere non ancora impostato: posizione di ripiego a meta' tavolo
    }

    // il badge del contatore mazzo sta un po' sotto il mazzo stesso (era
    // 730 quando il mazzo stava fermo a 560: stesso scarto di 170px, ora
    // applicato alla Y dinamica del mazziere)
    _deckBadgeY() { return this._deckBaseY() + 170 }

    _currentBackId() { return `Dorso${this._backCounter--}` }

    _bindEngineEvents() {
        this.engine.on('deal', (payload) => this._animateDeal(payload))
        this.engine.on('cardPlayed', (payload) => this._animatePlay(payload))
        this.engine.on('finalSweep', (payload) => this._animateFinalSweep(payload))
        this.engine.on('handOver', (result) => this._onHandOver(result))
        this.engine.on('turnChanged', ({ turnIndex }) => this._onTurnChanged(turnIndex))
    }

    preload(onReady) {
        const cfg = this.engine.rules.deckConfig()
        const ids = []
        for (const s of cfg.suits) for (const r of cfg.ranks) ids.push(`${r}${s}`)
        let loaded = 0
        const total = ids.length
        for (const id of ids) {
            $(`<img src="${this.opts.imagePath(id)}" id="${id}" class="fronte" style="position:absolute; display:none;">`)
                .on('load', () => { if (++loaded >= total) onReady() })
                .appendTo('#game-board')
        }
        for (let i = 1; i <= total; i++) {
            $(`<img src="${this.opts.backImagePath}" id="Dorso${i}" class="dorso" style="position:absolute; display:none;">`)
                .appendTo('#game-board')
        }

        // --- AVATAR E CONTATORI STILIZZATI COME DA CONCEPT ---
        
        // Badge contatore Mazzo (sinistra)
        $('#game-board').append('<div id="deck-badge" style="position:absolute; left: 65px; top: 730px; z-index:100; background-color:#1e3a8a; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">40</div>');
        
        // Badge prese PC (destra alto)
        $('#game-board').append('<div id="ai-pile-badge" style="position:absolute; left: 640px; top: 330px; z-index:100; background-color:#047857; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">0</div>');
        
        // Badge prese Giocatore (destra basso)
        $('#game-board').append('<div id="human-pile-badge" style="position:absolute; left: 640px; top: 1010px; z-index:100; background-color:#047857; border:3px solid white; border-radius:50%; width:55px; height:55px; display:flex; justify-content:center; align-items:center; color:white; font-family:Arial; font-weight:bold; font-size:22px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">0</div>');

        $('#game-board').append('<div id="info" style="position:absolute;color:white;background-color:transparent;font-weight:bold;width:fit-content;font-family:Arial;font-size:95%;line-height:1.25;white-space:pre-line;z-index:100"/>')
        
        // Bottone di conferma personalizzato
        $('#game-board').append('<button id="conferma-presa" style="position:absolute; display:none; z-index:200; padding:12px 28px; font-size:18px; font-weight:bold; background-color:#fbbf24; color:#1e462f; border:3px solid #fff; border-radius:30px; box-shadow:0 6px 15px rgba(0,0,0,0.4); cursor:pointer;">Conferma presa</button>')
        $('#conferma-presa').on('click', () => this._confirmCapture())

        if (this.opts.onHelp) {
            $(`<a href="#" id="help-link">Regole</a>`)
                .css({ position: 'absolute', left: '30px', top: '20px', color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial', fontSize: '90%', textDecoration: 'none', background: 'rgba(0,0,0,0.4)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', zIndex: 100 })
                .on('click', (e) => { e.preventDefault(); this.opts.onHelp() })
                .appendTo('#game-board')
        }

        if (this.opts.onOptions) {
            $(`<a href="#" id="options-link">&#9881;</a>`) // &#9881; = carattere ingranaggio, nessuna immagine da caricare
                .attr('title', 'Opzioni di gioco')
                .css({
                    position: 'absolute', right: '30px', top: '14px', width: '38px', height: '38px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.9)', fontSize: '20px', textDecoration: 'none',
                    background: 'rgba(0,0,0,0.4)', borderRadius: '50%', cursor: 'pointer', zIndex: 100,
                })
                .on('click', (e) => { e.preventDefault(); this.opts.onOptions() })
                .appendTo('#game-board')
        }
    }

    updateInfo(text) { 
        $('#info')
            .css({
                position: 'absolute',
                top: '15px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '400px',
                'font-size': '15px',       
                'line-height': '1.4',      
                'text-align': 'center',
                'background': 'rgba(0,0,0,0.4)',
                'padding': '8px 15px',
                'border-radius': '12px',
                'z-index': '100'
            })
            .html(text.replace(/\n/g, '<br>'))

        // Sincronizza i badge numerici con i dati reali del motore
        $('#deck-badge').text(this.engine.deck.count());
        $('#ai-pile-badge').text(this.engine.captured[this.opts.aiIndex].length);
        $('#human-pile-badge').text(this.engine.captured[this.opts.humanIndex].length);
    }

    // --- distribuzione ---
    _animateDeal({ target, playerIndex, slot, card }) {
        this._slideDeck(true);

        clearTimeout(this._deckSlideTimeout);
        this._deckSlideTimeout = setTimeout(() => {
            this._slideDeck(false); 
        }, 1000);

        const from = { left: 30, top: this._deckBaseY(), width: 110, height: 203, zIndex: 300 };
        const backId = this._currentBackId(); 

        // Se va sul banco o al giocatore umano, il dorso diventa "spent" (usato)
        if (target === 'table') {
            $(`#${backId}`).addClass('spent').hide(); 
            $(`#${card.id}`).show().css(from);
            this._layoutTable();
            return;
        }
        
        const isHuman = playerIndex === this.opts.humanIndex;
        if (isHuman) {
            $(`#${backId}`).addClass('spent').hide(); 
            $(`#${card.id}`).show().css(from)
                .animate({ left: this.opts.coord.human.x, top: this.opts.coord.human.y }, 500, () => {
                    $(`#${card.id}`).off('click').on('click', () => this._onHumanCardClick(slot));
                    this._layoutHand();
                });
        } else {
            // Se va all'IA, gli assegniamo la classe "in-ai-hand"
            this._aiHandBack[slot] = backId;
            $(`#${backId}`).removeClass('spent').addClass('in-ai-hand');
            
            const aiSpacing = 50;
            const aiWidth = 80;
            const aiHeight = 148;
            const startAiX = (720 - (2 * aiSpacing + aiWidth)) / 2;
            
            $(`#${backId}`).show().css(from)
                .animate({ 
                    left: startAiX + slot * aiSpacing, 
                    top: 100, 
                    width: aiWidth,
                    height: aiHeight
                }, 500, () => {
                    $(`#${backId}`).css('zIndex', 50);
                });
        }
    }

    _layoutHand() {
        const hand = this.engine.players[this.opts.humanIndex].hand
        const entries = hand
            .map((card, slot) => ({ slot, card }))
            .filter(e => e.card !== undefined)

        if (this.opts.sortHand !== false) {
            entries.sort((a, b) =>
                a.card.suit.localeCompare(b.card.suit) ||
                this.engine.rules.strength(a.card) - this.engine.rules.strength(b.card)
            )
        }

        const cardWidth = 180
        const cardHeight = 332
        const spacing = 120
        const totalWidth = entries.length > 0 ? (entries.length - 1) * spacing + cardWidth : 0
        const startX = (720 - totalWidth) / 2
        const top = 900 

        entries.forEach(({ slot, card }, i) => {
            $(`#${card.id}`)
                .css('zIndex', 200 + i) // <-- Cambiato da i a 200 + i
                .stop(true, false)
                .animate({ 
                    left: startX + i * spacing, 
                    top: top,
                    width: cardWidth,
                    height: cardHeight
                }, 300)
                .off('click')
                .on('click', () => this._onHumanCardClick(slot))
        })
    }

    _layoutTable() {
        const tableCards = this.engine.table
        const cardWidth = 110
        const cardHeight = 203
        const hSpacing = 15
        const vSpacing = 20

        const rows = []
        for (let i = 0; i < tableCards.length; i += 5) {
            rows.push(tableCards.slice(i, i + 5))
        }

        let currentCardIndex = 0
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.length * cardWidth + (row.length - 1) * hSpacing
            const startX = (720 - rowWidth) / 2
            
            let rowY = 440
            if (rows.length === 1) {
                rowY = 540
            } else {
                rowY = 430 + rowIndex * (cardHeight + vSpacing)
            }

            row.forEach((card, colIndex) => {
                const left = startX + colIndex * (cardWidth + hSpacing)
                const top = rowY
                $(`#${card.id}`).show()
                    .css('zIndex', 100 + currentCardIndex) // <-- Cambiato da currentCardIndex a 100 + currentCardIndex
                    .stop(true, false)
                    .animate({ 
                        left, 
                        top,
                        width: cardWidth,
                        height: cardHeight
                    }, 300)
                    .off('click')
                    .on('click', () => this._onTableCardClick(card))
                currentCardIndex++
            })
        })
    }

    // --- interazione umana ---

    _onHumanCardClick(slot) {
        try {
            if (this.engine.turnIndex !== this.opts.humanIndex) return
            const rules = this.engine.rules
            const card = this.engine.players[this.opts.humanIndex].hand[slot]
            if (!card) return

            const options = rules.findCaptures(card, this.engine.table)

            this._clearSelection()

            if (options.length === 0) {
                this._playHuman(slot, null)
                return
            }
            if (options.length === 1) {
                this._playHuman(slot, options[0])
                return
            }

            this._selectedSlot = slot
            this._pendingOptions = options
            $(`#${card.id}`).css({ outline: '4px solid gold' })
            this._highlightEligibleTableCards()
            this.updateInfo(this.opts.formatInfo(this.engine) + '\nScegli le carte da prendere sul tavolo, poi conferma.')
        } catch (err) {
            console.error('Errore nel gestire il click sulla carta:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa è andato storto: ' + err.message)
        }
    }

    _highlightEligibleTableCards() {
        const eligibleIds = new Set(this._pendingOptions.flat().map(c => c.id))
        for (const card of this.engine.table) {
            $(`#${card.id}`).css({ outline: eligibleIds.has(card.id) ? '3px dashed white' : 'none', opacity: eligibleIds.has(card.id) ? 1 : 0.6 })
        }
    }

    _onTableCardClick(card) {
        try {
            if (this.engine.turnIndex !== this.opts.humanIndex || this._selectedSlot === null) return
            const eligibleIds = new Set(this._pendingOptions.flat().map(c => c.id))
            if (!eligibleIds.has(card.id)) return

            if (this._selectedTableIds.has(card.id)) this._selectedTableIds.delete(card.id)
            else this._selectedTableIds.add(card.id)

            $(`#${card.id}`).css({ outline: this._selectedTableIds.has(card.id) ? '4px solid gold' : '3px dashed white' })

            const matches = this._pendingOptions.some(opt => this._sameIds(opt, [...this._selectedTableIds]))
            $('#conferma-presa').css({
                display: matches ? 'inline-block' : 'none',
                left: '50%',
                transform: 'translateX(-50%)',
                top: '810px', // Centrato orizzontalmente sopra la mano del giocatore
            })
        } catch (err) {
            console.error('Errore nel gestire il click su una carta del tavolo:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa è andato storto: ' + err.message)
        }
    }

    _sameIds(cards, ids) {
        if (cards.length !== ids.length) return false
        const a = cards.map(c => c.id).sort()
        const b = [...ids].sort()
        return a.every((id, i) => id === b[i])
    }

    _confirmCapture() {
        try {
            if (this._selectedSlot === null) return
            const chosen = this._pendingOptions.find(opt => this._sameIds(opt, [...this._selectedTableIds]))
            if (!chosen) return
            const slot = this._selectedSlot
            this._clearSelection()
            this._playHuman(slot, chosen)
        } catch (err) {
            console.error('Errore nel confermare la presa:', err)
            this._showDialog('Errore imprevisto', 'Qualcosa è andato storto: ' + err.message)
        }
    }

    _clearSelection() {
        for (const card of this.engine.table) $(`#${card.id}`).css({ outline: 'none', opacity: 1 })
        if (this._selectedSlot !== null) {
            const card = this.engine.players[this.opts.humanIndex].hand[this._selectedSlot]
            if (card) $(`#${card.id}`).css({ outline: 'none' })
        }
        this._selectedSlot = null
        this._pendingOptions = []
        this._selectedTableIds = new Set()
        $('#conferma-presa').hide()
    }

    _playHuman(slot, capture) {
        const result = this.engine.playCard(this.opts.humanIndex, slot, capture)
        if (!result.ok) this._showDialog('Errore', result.reason)
    }

    // --- IA ---

    playAiTurn() {
        const ai = this.engine.players[this.opts.aiIndex]
        if (ai.isHuman || ai.isHandEmpty()) return
        const view = this.engine.buildView(this.opts.aiIndex)
        const move = ai.strategy.chooseMove(view)
        this.engine.playCard(this.opts.aiIndex, move.slot, move.capture)
    }

    _onTurnChanged(turnIndex) {
        this._clearSelection()
        if (turnIndex === this.opts.humanIndex) {
            this._layoutHand()
        } else if (turnIndex === this.opts.aiIndex) {
            if (this.engine.handOver) return
            setTimeout(() => this.playAiTurn(), 900)
        }
    }

    // --- animazione della giocata ---

    _animatePlay({ playerIndex, card, slot, captured, isScopa }) {
        const isHuman = playerIndex === this.opts.humanIndex

        const card$ = $(`#${card.id}`)
        card$.stop(true, false)

        if (!isHuman) {
            const backId = this._aiHandBack[slot];
            if (backId) { 
                // Rimuove lo stato di "mano" e lo imposta come spento/nascosto
                $(`#${backId}`).removeClass('in-ai-hand').addClass('spent').hide(); 
                delete this._aiHandBack[slot]; 
            }
            
            const aiSpacing = 50;
            const aiWidth = 80;
            const aiHeight = 148;
            const startAiX = (720 - (2 * aiSpacing + aiWidth)) / 2;

            card$.css({ 
                left: startAiX + slot * aiSpacing, 
                top: 100, 
                zIndex: 100,
                width: aiWidth,
                height: aiHeight
            }).show();
        }
        card$.css({ transition: '', transform: '' }).show()

        if (isHuman) this._layoutHand()

        if (captured.length === 0) {
            this._layoutTable()
            this.updateInfo(this.opts.formatInfo(this.engine))
            return
        }

        const delayBeforeFly = isHuman ? 0 : 750
    
        setTimeout(() => {
            const pile = this.opts.coord.pile[playerIndex]
            const flying = [card, ...captured]
            flying.forEach((c, i) => {
                $(`#${c.id}`).show().stop(true, false)
                    .css('zIndex', 300) // <-- Forza il volo in primo piano
                    // Rimpicciolisce le carte mentre volano verso la pila di presa
                    .animate({ 
                        left: pile.x, 
                        top: pile.y,
                        width: 80,
                        height: 148
                    }, 400 + i * 60, function () {
                        $(this).fadeOut(200)
                    })
            })
            setTimeout(() => {
                this._layoutTable()
                this.updateInfo(this.opts.formatInfo(this.engine))
                if (isScopa) this._showScopaBanner()
            }, 400 + flying.length * 60 + 250)
        }, delayBeforeFly)
    }

    // Banner "SCOPA!" grande, colorato e allegro al centro dello schermo,
    // visibile per circa un secondo — sostituisce la vecchia annotazione nel
    // pannello info in alto, molto meno appariscente e facile da perdere
    _showScopaBanner() {
        const colors = ['#ff5252', '#ffb300', '#43a047', '#29b6f6', '#ab47bc', '#ff7043']
        const letters = 'SCOPA!'.split('').map((ch, i) => {
            const tilt = (i % 2 === 0 ? -1 : 1) * (6 + (i % 3) * 3)
            return `<span style="display:inline-block; color:${colors[i % colors.length]}; transform: rotate(${tilt}deg);">${ch}</span>`
        }).join('')

        $('#scopa-banner').remove() // nel caso (raro) di due scope ravvicinate, non accavallarle
        const $banner = $(`<div id="scopa-banner">${letters}</div>`).css({
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%) scale(0.4)',
            fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900,
            fontSize: '92px', textShadow: '3px 3px 0 rgba(0,0,0,0.35)',
            zIndex: 500, opacity: 0, pointerEvents: 'none', whiteSpace: 'nowrap',
        }).appendTo('#game-board')

        // l'ingresso "a molla" (leggero rimbalzo) e' una transition CSS sul
        // transform, non un jQuery.animate: jQuery non sa interpolare in modo
        // sensato una proprieta' composita come transform
        $banner.css('transition', 'transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.2s')
        requestAnimationFrame(() => $banner.css({ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }))

        setTimeout(() => {
            $banner.css({ transition: 'opacity 0.25s', opacity: 0 })
            setTimeout(() => $banner.remove(), 250)
        }, 1000)
    }

    _animateFinalSweep({ playerIndex, cards }) {
        const pile = this.opts.coord.pile[playerIndex]
        cards.forEach((c, i) => {
            $(`#${c.id}`).stop(true, false)
                .css('zIndex', 300) // <-- Forza il volo in primo piano anche a fine smazzata
                .animate({ 
                    left: pile.x, 
                    top: pile.y,
                    width: 80,
                    height: 148
                }, 400 + i * 60, function () { $(this).fadeOut(200) })
        })
    }

    _onHandOver(result) {
        if (this.opts.onHandOver) this.opts.onHandOver(result)
    }

    _showDialog(title, text, onClose) {
        $(`<div title="${title}"/>`).html(text).dialog({
            modal: true,
            width: responsiveDialogWidth(360),
            buttons: { Ok: function () { $(this).dialog('close') } },
            close: function () {
                if (onClose) onClose()
                $(this).dialog('destroy').remove()
            },
        })
    }

    _slideDeck(visible) {
        const targetX = visible ? 30 : -92;
        const badgeTargetX = visible ? 65 : 12;

        // Fai scorrere le carte del mazzo (dorsi), escludendo quelle già
        // volate nel ventaglio dell'IA o già giocate: altrimenti ogni nuova
        // distribuzione le ritrascina verso il mazzo, e la chiusura finale
        // le sposta fuori schermo assieme al resto del mazzo.
        $('img.dorso').not('.in-ai-hand, .spent').each(function(index) {
            const offset = index * -0.1; // Mantiene il micro-effetto 3D dello stack
            $(this).stop(true, false).animate({
                left: targetX + offset
            }, 400);
        });

        // Fai scorrere il badge numerico
        $('#deck-badge').stop(true, false).animate({
            left: badgeTargetX
        }, 400);
    }

    drawDeckStack() {
        const self = this;
        const baseX = -92, baseY = this._deckBaseY();
        const cardW = 110, cardH = 203;
        
        // 1. POSIZIONA SOLO I DORSI ANCORA NEL MAZZO (Esclude quelli in mano all'IA o già usati)
        let x = baseX, y = baseY, z = 5;
        $('img.dorso').not('.in-ai-hand, .spent').each(function () {
            $(this).css({ 
                left: x, 
                top: y, 
                zIndex: z,
                width: cardW,
                height: cardH 
            }).show();
            x -= 0.1; 
            y -= 0.1; 
            z += 1;
        });

        // 2. RIPRISTINA E MANTIENE I DORSI NELLA MANO DELL'AVVERSARIO (A NORD)
        const aiSpacing = 50;
        const aiWidth = 80;
        const aiHeight = 148;
        const startAiX = (720 - (2 * aiSpacing + aiWidth)) / 2;

        $('img.dorso.in-ai-hand').each(function () {
            const id = $(this).attr('id');
            let slot = -1;
            
            // Cerca a quale slot appartiene questo ID dorso
            if (self._aiHandBack) {
                slot = Object.keys(self._aiHandBack).find(key => self._aiHandBack[key] === id);
            }
            
            if (slot !== undefined && slot !== -1) {
                const numericSlot = parseInt(slot, 10);
                $(this).css({
                    left: startAiX + numericSlot * aiSpacing,
                    top: 100, // Posizionamento fisso in alto a Nord
                    width: aiWidth,
                    height: aiHeight,
                    zIndex: 50
                }).show();
            }
        });

        // 3. FORZA LA SCOMPARSA DEI DORSI GIÀ USATI
        $('img.dorso.spent').hide();

        // Forza la posizione iniziale del badge sul bordo visibile, alla
        // stessa altezza (dinamica, dalla parte del mazziere) del mazzo
        $('#deck-badge').css({ left: '12px', top: this._deckBadgeY() });
    }

    showMessage(title, text, onClose) { this._showDialog(title, text, onClose) }

    reset() {
        this._aiHandBack = {};
        this._backCounter = this._totalDeckSize();
        this._clearSelection();
        
        // Rimuove tutte le classi di stato dai dorsi per rimetterli nel mazzo
        $('img.dorso').removeClass('in-ai-hand spent'); 

        $('img').each(function () {
            $(this).stop(true, false).hide().off('click').css({ 
                transition: '', 
                transform: '', 
                outline: 'none', 
                opacity: 1, 
                zIndex: 0 
            });
        });
        
        $('#deck-badge').text('40').css({ left: '12px' });
        this._slideDeck(false); 

        this.drawDeckStack();
    }
}