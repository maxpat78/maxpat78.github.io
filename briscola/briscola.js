﻿//
// Gioco tradizionale della Briscola italiana
//
// (C)2024, maxpat78. Licenziato in conformità alla GNU GPL v3.
//

const revisione = "$Revisione: 1.119"
DEBUG = 0

// costruisce un mazzo simbolico di 40 carte regionali italiane
// personalizzato per il gioco della Briscola o della Marianna
const mazzo_semi = "BCDS" // Bastoni, Coppe, Denari, Spade
// mazzo_valori è qui ordinato per valore di presa nella Briscola
const mazzo_valori = "24567FCR3A" // A=Asso, F=Fante, C=Cavallo, R=Re
// mazzo_punti è qui ordinato per punti nella Briscola
const mazzo_punti = [0,0,0,0,0,2,3,4,10,11]
const nome_valori = ['Due', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Fante', 'Cavallo', 'Re', 'Tre', 'Asso']
const nome_semi = ['Bastoni', 'Coppe', 'Danari', 'Spade']


// differenza di array: rimuove gli elementi in arr
Array.prototype.diff = function(arr) {
    for (a of arr) {
        var i = this.indexOf(a)
        if (i > -1) this.splice(i, 1)
    }
    return this
}


class Mazzo {
    constructor() {
        this.mazzo = []
        for (let i in mazzo_semi)
            for (let j in mazzo_valori)
                this.mazzo.push(mazzo_valori[j]+mazzo_semi[i])
        this.mazzo.sort((a,b) => 0.5 - Math.random()) // ordina a caso (=mescola)
        this.briscola = this.mazzo.slice(-1)[0]
    }

    // pesca una carta, rimuovendola dalla pila
    pesca() { return this.mazzo.shift() }

    vuoto() { return this.mazzo.length == 0 }

    carte() { return this.mazzo.length }

    // mostra il nome completo della carta
    nome(carta) {
        return nome_valori[ mazzo_valori.indexOf(carta[0]) ] + ' di ' + nome_semi[ mazzo_semi.indexOf(carta[1]) ]
    }

    // mostra il nome del seme della carta
    seme(carta) { return nome_semi[ mazzo_semi.indexOf(carta[1]) ] }

    // ritorna i punti corrispondenti alla carta
    punti(carta) { return mazzo_punti[mazzo_valori.indexOf(carta[0])] }

    // ritorna il valore di presa della carta
    valore(carta) { return mazzo_valori.indexOf(carta[0]) }

    // ritorna un numero positivo se carta1 prende carta2, negativo in caso contrario
    // tiene conto del seme di briscola
    // se i semi sono diversi, prende la carta giocata prima (0=carta1)
    prende(carta1, carta2, prima) {
        // una sola briscola?
        if (carta1[1] == this.briscola[1] && carta2[1] != this.briscola[1]) return 1
        if (carta1[1] != this.briscola[1] && carta2[1] == this.briscola[1]) return -1
        // semi diversi?
        if (carta1[1] != carta2[1]) return (prima==0)? 1 : -1
        // semi uguali: compara i valori di presa
        return this.valore(carta1) - this.valore(carta2) 
    }
}


class IA {
    gioca(partita) {
        this.partita = partita
        var carta = this.algo2()
        partita.gioca(0, carta)
        this.di_turno = 1
    }

    // seleziona una carta a caso (demo)
    algo1() { return Math.floor((Math.random()*this.partita.mani[0].length)) }

    // seleziona una carta con il criterio massimo beneficio, minimo danno
    algo2() {
        if (this.partita.primo_di_mano == 0)
            return this.gioca_primo()
        else
            return this.gioca_secondo()
        if (DEBUG) console.log('ATTENZIONE: algo2 risponde a caso, non dovrebbe succedere MAI!!!')
        return this.algo1()
    }

    // gioca primo di mano:
    // - la carta di maggior valore che non può essere presa o
    // - la carta di minor valore
    // le briscole valgono di più
    gioca_primo() {
        // ottiene i casi per ogni giocata possibile
        var casi = this.casi()
        // cerca una carta che non può essere presa
        casi.sort((a,b) => a.maggiori - b.maggiori)
        if (DEBUG) console.log('casi (1)', casi)
        if (this.partita.cronologia.length == 32) {
            if (DEBUG) console.log('valuta la presa della briscola')
            var punti_mano = this.conta_punti(this.partita.mani[0])
            var punti_presi = this.partita.cronologia.reduce((tot, x) => tot + this.partita.mazzo.punti(x.carta), 0)
            if (DEBUG) console.log('punti presi, mano:', punti_presi, punti_mano)
            if (this.partita.mazzo.punti(this.partita.mazzo.briscola)) {
                // riordina per valore e restituisce la carta di maggior valore, per indurre l'avversario a prendere
                casi.sort((a,b) => b.valore - a.valore)
                return this.partita.mani[0].indexOf(casi[0].carta)
            }
        }
        for (var i=0; i < casi.length; i++) {
            if (!casi[i].maggiori) return this.partita.mani[0].indexOf(casi[i].carta)
        }
        // riordina per valore e restituisce la carta che vale meno
        casi.sort((a,b) => a.valore - b.valore)
        if (DEBUG) console.log('casi (2)', casi)
        return this.partita.mani[0].indexOf(casi[0].carta)
    }

    // gioca secondo di mano, analizzando punti e probabilità per ogni carta giocabile
    gioca_secondo() {
        var p = this.partita
        var casi = []
        var casi2 = this.casi()
        for (var i=0; i < p.mani[0].length; i++) {
            if (!p.mani[0][i]) continue // se la carta è undefined
            let o = casi2.filter((x) => x.carta == p.mani[0][i])[0] // trova il dizionario relativo alla carta
            casi.push( this.compara2(o, p.mani[0][i], p.giocate[1], p.mazzo.briscola[1], 0) )
        }
        var r = this.analizza4(casi)
        return r
    }

    // per ogni carta della mano, determina quante carte può ancora prendere e da quante può essere presa
    // valuta le marianne ancora possibili
    // assegna un valore conseguente
    casi() {
        var casi = [], pm=0
        var m = this.partita.mazzo
        var mano_mia = this.partita.mani[0].filter((x) => x != undefined)
        var mano_sua = this.partita.mani[1].filter((x) => x != undefined)
        var ignote = [...m.mazzo].concat(mano_sua)
        for (var carta of mano_mia) {
            var maggiori = ignote.map((x) => {if (m.prende(x, carta, 1) > 0) return x})
            .filter((x) => x != undefined)
            var minori = ignote.map((x) => {if (m.prende(carta, x, 1) > 0) return x})
            .filter((x) => x != undefined)
            var punti = Math.max(...minori.map((x) => m.punti(x))) // punti massimi che potrebbe prendere
            if (punti == -Infinity) punti = 0
            var v = m.punti(carta) + m.valore(carta) // somma del valore in punti e della forza di presa
            // valore max carte normali: 11 (punti A) + 9 (presa A) = 20; min: 2 (punti F) + 5 (presa F) = 7
            casi.push({carta: carta, valore: v, minori: minori.length, maggiori: maggiori.length})
        }
        casi.sort((a,b) => a.valore - b.valore)
        return casi
    }

    // determina chi fa presa e quanti punti riceve, ritornando un dizionario con i dati
    compara2(dict, mia_carta, sua_carta, briscola, primo) {
        let punti = this.partita.mazzo.punti
        // prendo = 1 (io), 0 (lui)
        // briscola = se mia_carta è una briscola
        var o = {carta:mia_carta, prendo:0, punti:0, guadagno:0, briscola:mia_carta[1]==briscola}
        o = {...dict, ...o}
        o.punti = punti(mia_carta) + punti(sua_carta)
        // determina se prendo
        o.prendo = this.partita.mazzo.prende(mia_carta, sua_carta, this.partita.primo_di_mano) > 0? 1:0
        // calcola il guadagno come punti presi da lui o persi da me
        if (o.prendo)
            o.guadagno = punti(sua_carta)
        else
            o.guadagno = punti(mia_carta)
        return o
    }

    // ritorna l'indice della migliore mossa possibile, rapportato alla mano del PC
    // Re e Cavallo sono conservati a oltranza finché è possibile la marianna
    analizza4(casi) {
        if (DEBUG) console.log('analizza4:\n', casi)
        var prese=[], perse=[]
        var mano = this.partita.mani[0]

        // separa prese e lasciate
        for (var i in casi) casi[i].prendo ? prese.push(casi[i]) : perse.push(casi[i])

        // cerca una presa che dia punti
        prese.sort((a,b) => b.punti - a.punti) // ordina per punti, dalla più conveniente
    
        if (this.partita.cronologia.length == 33) {
            if (DEBUG) console.log('valuta la presa della briscola')
            // cerca di lasciare se la briscola ha valore intrinseco
            if (this.partita.mazzo.punti(this.partita.mazzo.briscola)) {
                if (perse.length) {
                    perse.sort((a,b) => a.valore - b.valore)
                    return mano.indexOf(perse[0].carta)
                }
            }
        }

        for (var i=0; i < prese.length; i++) {
            if (prese[i].punti) return mano.indexOf(prese[i].carta)
        }
    
        // se ci sono possibili prese senza punti che agevolano il successivo gioco 
        // di carte imprendibili, tipo gli A, le realizza
        if (DEBUG) console.log('PSP:', prese.filter((x) => x.punti == 0), prese.filter((x) => x.maggiori == 0))
        var psp = prese.filter((x) => x.punti == 0)
        if (perse.filter((x) => x.maggiori == 0).length && psp.length) return mano.indexOf(psp[0].carta)

        // nella fase finale, adotta un approccio diverso
        if (this.partita.cronologia.length > 34)
            perse.sort((a,b) => a.minori - b.minori || a.valore - b.valore) // carta con meno possibilità di presa e valore
        else 
            // cerca la carta di minor valore e possibilità di presa
            perse.sort((a,b) => a.valore - b.valore + b.minori - a.minori)
    
        if (perse.length) return mano.indexOf(perse[0].carta)

        // se non è stato ancora possibile scegliere...
        if (prese.length) {
            prese.sort((a,b) => a.valore - b.valore)
            return mano.indexOf(prese[0].carta)
        }

        return mano.indexOf(perse[0].carta)
    }

    // conta le eventuali briscole in mano
    briscole() {
        var briscole = 0
        for (var c of this.partita.mani[0])
            if (c && c[1] == this.partita.mazzo.briscola[1]) briscole++
        return briscole
    }

    // conta i punti contenuti in un array di carte
    conta_punti(mano) {
        var punti = 0
        for (var c of mano)
            if (c) punti += this.partita.mazzo.punti(c)
        return punti
    }
}


class Tavolo {
    constructor() {
        // coordinate assolute in px delle mani e del banco
        this.coord = [ {x: 320, y: 1}, // PC
        {x: 320, y: 585}, // Umano
        {x: 410, y: 293} // Banco
        ]
        this.attesa = 0 // il giocatore umano deve attendere l'esito della mano
        this.svuota()
        this.gfx_load = 0 // indica se le carte sono state completamente caricate
        this.carica_carte()
    
        $('<div id="dialog" title="Regole della Briscola">').appendTo("body")
    
        $.ajax({
          url: "aiuto_briscola.txt",
          dataType: "text",
          success: function(s) {
            $("#dialog")
            .append($("<p>").html(s))
            .dialog()
          }
        })

    }

    // azzera i parametri di partita
    svuota() {
        this.mazzo = new Mazzo()
        if (DEBUG) console.log(`La briscola è ${this.mazzo.seme(this.mazzo.briscola)}`)
        this.mani = [[], []] // array di array con le 3 carte simboliche in mano (0=PC, 1=umano)
        this.giocate = [] // carte giocate sul banco (0=PC, 1=umano)
        this.di_turno = 1 // chi deve fare la mossa corrente (0=PC, 1=umano)
        this.primo_di_mano = 1 // chi era primo di mano (0=PC, 1=umano)
        this.carte_giocate = [] // le 2 carte giocate in una mano
        this.cronologia = [] // cronologia delle mani della smazzata
        this.giocatore_pc = new IA()
        this.punti_pc = this.punti_me = 0
    }

    riavvia() {
        this.svuota()
        // nasconde qualsiasi carta visibile e rimuove qualsiasi gestore di evento e trasformazione
        $('img').each(function() {
            $(this).hide().off('click').css({"transition": "", "transform": "", "transform-origin": "", "transform-style": "", zIndex: 0})
        })
        this.disegna()
    }

    onLoad() {
        if (this.gfx_load++ < 40) return
        this.disegna()
    }

    // precarica le immagini di tutte le carte, la prima volta
    carica_carte() {
        for (var i of this.mazzo.mazzo.concat('Dorso'))
            $(`<img src="../trieste/${i}.webp" id="${i}" class="fronte" width="150px" height="277px" style="position:absolute">`)
            .on("load", this.onLoad.bind(this))
            .hide()
            .appendTo('body')

        for (var i=1; i < 40; i++)
            $(`<img src="../trieste/Dorso.webp" id="Dorso${i}" class="dorso" width="150px" height="277px" style="position:absolute">`)
            .hide()
            .appendTo('body')

        // disegna un div informativo con il numero di carte restanti e i punti in basso a destra
        $('body').append('<div id="info" style="position:absolute;color:white;background-color:transparent;font-weight:bold;width:fit-content;align:center;font-family:Arial;font-size:120%;zindex:100"/>')
        $('#info').css({top: this.coord[1].y, left: this.coord[1].x - 150})
        .text(`${this.punti_pc} - ${this.punti_me} [${this.mazzo.carte()}]`)
    }

    disegna() {
        this.disegnaMazzo()
        this.daiCarte()
    }

    disegnaMazzo() {
        // posizione del mazzo in pixel
        var x=10, y=293, z=-100, img

        // disegna la briscola trasversalmente a metà mazzo
        $('#'+this.mazzo.briscola)
        .show()
        .css({'left': (x+(277-150)/2), 'top': y, 'transform': 'rotate(90deg)', 'zIndex': -101})

        // disegna i dorsi sovrapposti, simulando il 3D
        $('img[class="dorso"]').each( function() {
            $(this).css({left: x, top: y, zIndex: z}).show()
            x -= 0.1
            y -= 0.1
            z += 1
        })
    }

    // aggiorna le info con il numero di carte restanti e i punti
    disegnaRestanti() { $('#info').text(`${this.punti_pc} - ${this.punti_me} [${this.mazzo.carte()}]`) }

    // dà una carta al giocatore (0=PC, 1=umano). indice è la posizione nella mano (0-2).
    // tempo è la durata dell'animazione in ms
    daiCarta(giocatore, indice, tempo=1000) {
        var carta = this.mazzo.pesca()
        if (! carta) return
        this.attesa = 1
        var vuoto = this.mazzo.vuoto()
        this.mani[giocatore][indice] = carta
        if (DEBUG) console.log(`giocatore ${giocatore} riceve ${carta} in posizione ${indice}: ${this.mani[giocatore]}`)
        // se è la briscola (ultima), ripristina l'orientamento; altrimenti seleziona un dorso
        var img = vuoto? $('#'+this.mazzo.briscola).css({transform: ''}) : $('#Dorso'+this.mazzo.carte())
        img
        .css({zIndex: indice}) // porta subito il dorso al livello corretto della mano
        .animate( {left: this.coord[giocatore].x + indice*90, top: this.coord[giocatore].y},
                        tempo,
                        function () { // eseguita al termine dell'animazione
                            var p = $(this).position()
                            if (giocatore) {
                                // Il dorso è ruotato di 90° in 1/2s sull'asse sx a circa 1/3 e 1/2
                                // Al termine della rotazione viene nascosto, e mostrato il fronte della carta sottostante
                                if (!vuoto) $(this).css({"transition": "0.5s", "transform": "rotateY(90deg)", "transform-origin": "33% 50%", "transform-style": "preserve-3d"})
                                setTimeout(function() {
                                    $(`#${carta}`).show().css({left: p.left, top: p.top, zIndex: indice})
                                    $(`#${carta}`).click(function() {partita.gioca(1,indice)})
                                    if (!vuoto) $(this).hide() // nasconde il dorso
                                }, 500)
                            }
                            else {
                                $(this).css({zIndex: indice}) // sposta il dorso del PC al livello corretto nel ventaglio
                                if (vuoto) {
                                    $('#Dorso39').show().css({left: $(this).position().left, top: $(this).position().top, zIndex: indice})
                                    $(this).hide()
                                }
                            }
                        } )
        this.disegnaRestanti()
        this.attesa = 0
    }

    // fa la distribuzione iniziale delle carte
    daiCarte() {
        var tempo = 700 // la durata dell'animazione è leggermente diversa per ogni carta, così da distinguerle
        for (var i=0; i<3; i++) {
            this.daiCarta(0, i, tempo-100) // al PC
            this.daiCarta(1, i, tempo) // a me
        }
    }

    // gioca la carta indice=0..2 del giocatore=0..1
    gioca(giocatore, indice) {
        if (this.cronologia.length == 40) return
        // non elabora i click sulle carte fino all'esito della mano
        if (giocatore && this.attesa) return
        if (giocatore) this.attesa = 1
        var pausa = 0
        var d_banco = this.giocate.length? 90:0 // seleziona una delle 2 posizioni sul banco
        var C = {left: this.coord[giocatore].x + indice*90, top: this.coord[giocatore].y } // coordinate della carta in mano
        // mostra e anima la carta giocata da mano a banco
        $(`#${this.mani[giocatore][indice]}`)
            .show()
            .css({left: C.left, top: C.top, zIndex: d_banco+3}) // zIndex+3 sovrappone la giocata alla mano
            .animate({left: this.coord[2].x + d_banco, top: this.coord[2].y}, 500)
        // nasconde il dorso della carta giocata dal PC
        if (!giocatore)
            $('img')
                .filter(function() {return $(this).attr('id').includes('Dorso') && $(this).offset().left == C.left})
                .hide()
        // aggiorna mano e banco
        this.giocate[giocatore] = this.mani[giocatore][indice]
        // la posizione nella mano rimane undefined fino all'eventuale pescata successiva
        this.mani[giocatore][indice] = undefined
        if (DEBUG) console.log(`giocatore ${giocatore} gioca carta ${this.giocate[giocatore]} da posizione ${indice}`)
        // inserisce la mossa nella cronologia
        this.cronologia.push({giocatore: giocatore, indice: indice, carta: this.giocate[giocatore]})
        // se ha giocato per primo l'umano, fa giocare il PC
        if (this.di_turno == 1) {
            pausa=1600
            this.di_turno = 0
            // evita che la risposta del PC sia contemporanea all'animazione della giocata umana
            if (this.cronologia.length < 40) setTimeout(this.giocatore_pc.gioca.bind(this.giocatore_pc), pausa, this)
        }
        // se ambedue hanno giocato, determina chi prende
        if (this.giocate.length == 2) setTimeout(this.arbitra.bind(this), pausa+1500, 0)
    }

    // determina chi ha vinto la mano, sposta le carte, pesca e prepara la prossima  mano
    arbitra() {
        if (this.giocate.length != 2) return
        console.log('giocate', this.giocate)
        // determina chi prende
        var r = this.mazzo.prende(this.giocate[0], this.giocate[1], this.primo_di_mano)
        // calcola i punti presi
        var punti = this.mazzo.punti(this.giocate[0]) + this.mazzo.punti(this.giocate[1])
        var indici = []
        indici[this.cronologia.slice(-1)[0].giocatore] = this.cronologia.slice(-1)[0].indice
        indici[this.cronologia.slice(-2,-1)[0].giocatore] = this.cronologia.slice(-2,-1)[0].indice

        // fa scorrere la carta dietro un angolo del giocatore e, al termine, ruota la carta, la nasconde progressivamente,
        // mostra il dorso al suo posto e lo nasconde progressivamente
        function _animaCarta(c, g, o) {
            var x=o.coord[g].x-100, y=o.coord[g].y + (g==0? -100:100)
            $(`#${c}`)
                .css({zIndex: $(`#${c}`).css('zIndex')+100})
                .animate({left: x, top: y}, 500, function() {
                    $(this).css({"transition": "0.5s all ease-out", "transform": "rotateY(90deg)", "transform-origin": "33% 50%", "transform-style": "preserve-3d"})
                    .fadeOut(500)
                    setTimeout(function() {
                        $('#Dorso39')
                        .css({left: x, top: y, zIndex: $(`#${c}`).css('zIndex')+100})
                        .show()
                        .fadeOut(500)
                    }, 500)
                })
        }

        if (r < 0) {
            if (DEBUG) console.log(`UMANO prende ${punti} punti`)
            this.punti_me += punti
            this.di_turno = this.primo_di_mano = 1
            // anima la presa
            _animaCarta(this.giocate[0], 1, this)
            _animaCarta(this.giocate[1], 1, this)
            // pesca (l'animazione del 2° è leggermente più lenta, per distinguere visivamente i turni di pescata)
            setTimeout(this.daiCarta.bind(this), 500, 1, indici[1])
            setTimeout(this.daiCarta.bind(this), 900, 0, indici[0], 600)
        } else
        if (r > 0) {
            if (DEBUG) console.log(`PC prende ${punti} punti`)
            this.punti_pc += punti
            this.di_turno = this.primo_di_mano = 0
            _animaCarta(this.giocate[0], 0, this)
            _animaCarta(this.giocate[1], 0, this)
            setTimeout(this.daiCarta.bind(this), 500, 0, indici[0])
            setTimeout(this.daiCarta.bind(this), 900, 1, indici[1])
            if (this.cronologia.length < 40) setTimeout(this.giocatore_pc.gioca.bind(this.giocatore_pc), 2000, this)
        }
    
        this.disegnaRestanti()
        this.giocate = []
        this.attesa = 0

        // se sono state giocate tutte le mani, designa il vincitore
         if (this.cronologia.length == 40) setTimeout(this.vittoria.bind(this), 1700)
        
    }
    
    vittoria() {
        var s
            if (this.punti_me == this.punti_pc) s = 'Pareggio!'
            if (this.punti_me > this.punti_pc) s = `${this.punti_me} a ${this.punti_pc}: hai vinto tu!`
            if (this.punti_me < this.punti_pc) s = `${this.punti_pc} a ${this.punti_me}: ho vinto io!`
            $('<div title="Partita finita!"/>')
            .text(s)
            .dialog({
                    modal: true,
                    buttons: {Ok: function() { $( this ).dialog( "close" )} }
                    })
            this.riavvia()
    }
}
