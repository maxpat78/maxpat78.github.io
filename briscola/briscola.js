//
// Gioco tradizionale della Briscola italiana
//
// (C)2024, maxpat78. Licenziato in conformità alla GNU GPL v3.
//

const revisione = "$Revisione: 1.112"
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


class Mazzo {
    constructor() {
        this.mazzo = []
        for (let i in mazzo_semi)
            for (let j in mazzo_valori)
                this.mazzo.push(mazzo_valori[j]+mazzo_semi[i])
        this.mazzo.sort((a,b) => 0.5 - Math.random()) // ordina a caso (=mescola)
        this.briscola = this.mazzo.slice(-1)[0] // la carta di briscola sarà l'ultima pescata nel mazzo riordinato
        // per la Marianna senza briscola, usare 'NN'
        if (DEBUG) console.log(`La briscola è ${this.seme(this.briscola)}`)
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
    // se i semi sono diversi, prende la carta giocata prima
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
        //~ console.log(`algo2 ha selezionato la possibile mossa in posizione ${carta}`)
        partita.gioca(0, carta)
        this.di_turno = 1
    }

    // seleziona una carta a caso (demo)
    algo1() { return Math.floor((Math.random()*this.partita.mani[0].length)) }

    // seleziona una carta con il criterio massimo beneficio, minimo danno
    algo2() {
        var p = this.partita
        var possibili = []
        // se il PC gioca primo di mano...
        if (p.primo_di_mano == 0) {
            // ...sceglie la carta di minor valore
            return this.minore()
        }
        // ...altrimenti, cerca la mossa migliore
        else {
            for (var i=0; i < p.mani[0].length; i++) {
                if (!p.mani[0][i]) continue // se la carta è undefined
                possibili.push( this.compara2(p.mani[0][i], p.giocate[1], p.mazzo.briscola[1], 0) )
            }
            return this.analizza3(possibili)
        }
        if (DEBUG) console.log('ATTENZIONE: algo2 risponde a caso, non dovrebbe succedere MAI!!!')
        return this.algo1()
    }

    // determina chi fa presa e quanti punti riceve, ritornando un dizionario con i dati
    compara2(mia_carta, sua_carta, briscola, primo) {
        let punti = this.partita.mazzo.punti
        // prende = 1 (io), 0 (lui)
        // briscola = se mia_carta è una briscola
        var o = {carta:mia_carta, prende:0, punti:0, guadagno:0, briscola:mia_carta[1]==briscola}
        o.punti = punti(mia_carta) + punti(sua_carta)
        // verifica se prendo io
        // una sola briscola?
        if (mia_carta[1] == briscola && sua_carta[1] != briscola)
            o.prende = 1
        // semi diversi?
        else if (mia_carta[1] != sua_carta[1]) {
            if (primo) o.prende = 1
        }
        // stesso seme?
        else
            o.prende = (this.partita.mazzo.prende(mia_carta, sua_carta) > 0)? 1 : 0
        // calcola il guadagno come punti presi da lui o persi da me
        if (o.prende)
            o.guadagno = punti(sua_carta)
        else
            o.guadagno = punti(mia_carta)
        return o
    }

    // ritorna l'indice della migliore mossa possibile, rapportato alla mano del PC
    // miglior mossa è quella che dà più punti al PC, o meno punti all'avversario
    // tenta di conservare le briscole
    analizza3(casi) {
        if (DEBUG) console.log('mosse possibili:', casi)
        var prese=[], perse=[]
        var miglior_punto = null
        var miglior_senza = null
        var mano = this.partita.mani[0]
    
        // separa prese e lasciate
        for (var i in casi) casi[i].prende ? prese.push(casi[i]) : perse.push(casi[i])

        if (prese.length) {
            var con_punti = prese.filter((a) => a.punti)
            var senza_briscola = prese.filter((a) => !a.briscola)
            if (con_punti.length) {
                con_punti.sort((a,b) => b.punti - a.punti) // ordina per punti
                miglior_punto = con_punti[0]
                con_punti.sort((a,b) => { // per briscola
                    if (a.briscola && !b.briscola) return 1
                    if (b.briscola && !a.briscola) return -1
                    return this.partita.mazzo.valore(a.carta) - this.partita.mazzo.valore(b.carta)
                })
                // preferisce il miglior punto senza briscola o con briscola minore
                if (miglior_punto.briscola && miglior_punto != con_punti[0])
                    miglior_punto = con_punti[0]
            }
            if (senza_briscola.length) {
                senza_briscola.sort((a,b) => b.punti - a.punti) 
                miglior_senza = senza_briscola[0]
            }
            if (DEBUG) console.log('prese:',prese,'\n','migliore senza:',miglior_senza,'\n','miglior punto:', miglior_punto)
            // preferisce la miglior presa senza briscola che dà punti
            if (miglior_senza && miglior_senza.punti)
                return mano.indexOf(miglior_senza.carta)
            // preferisce la presa che dà punti e o non è di briscola o, essendolo, dà un valore aggiunto
            if (miglior_punto && miglior_punto.punti && (!miglior_punto.briscola || miglior_punto.guadagno))
                return mano.indexOf(miglior_punto.carta)
        }
        // se non può lasciare...
        if (!perse.length) {
            if (miglior_senza) return mano.indexOf(miglior_senza.carta)
            if (miglior_punto) return mano.indexOf(miglior_punto.carta)
            return mano.indexOf(prese[0].carta)
        }

        // come valutare la perdita di una briscola?
        perse.sort( (a,b) => (a.guadagno + (a.briscola? 2:0)) - (b.guadagno + (b.briscola? 2:0)))
        if (DEBUG) console.log('perse:', perse)
        // prende anche se la carta lasciata darebbe punti extra
        if (prese.length && perse[0].guadagno)
            return mano.indexOf(miglior_punto? miglior_punto.carta : prese[0].carta)
        // altrimenti, lascia
        return mano.indexOf(perse[0].carta)
    }

    // ritorna il valore di una carta, +5 se è di briscola
    // se puro=1, non distingue le briscole
    valore(carta, puro=0) {
        var valore = this.partita.mazzo.punti(carta)
        if (carta[1] == this.partita.mazzo.briscola[1] && !puro) valore += 5
        return valore
    }
    
    // determina quale delle carte in mano ha minor valore
    minore() {
        var c, c1, c2
        var mano = this.partita.mani[0].filter((x) => x) // clona in un array locale le sole carte valide
        mano.sort( (a,b) => this.valore(a,1) - this.valore(b,1) )
        c1 = mano[0]
        mano.sort( (a,b) => this.valore(a) - this.valore(b) )
        c2 = mano[0]
        c = c1
        if (c1[1] == this.partita.mazzo.briscola[1]) c = c2
        if (DEBUG) console.log(c, 'è la carta minore fra', mano)
        return this.partita.mani[0].indexOf(c)
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
    }

    // azzera i parametri di partita
    svuota() {
        this.mazzo = new Mazzo()
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
        $('img').each(function() {$(this).hide()}) // nasconde qualsiasi carta visibile
        $('img[class="fronte"]').each(function() {$(this).off('click')}) // rimuove qualsiasi gestore di evento
        this.disegna()
    }

    onLoad() {
        if (this.gfx_load++ < 40) return
        this.disegna()
    }

    // precarica le immagini di tutte le carte, la prima volta
    carica_carte() {
        for (var i of this.mazzo.mazzo.concat('Dorso'))
            $(`<img src="trieste/${i}.webp" id="${i}" class="fronte" width="150px" height="277px" style="position:absolute">`)
            .on("load", this.onLoad.bind(this))
            .hide()
            .appendTo('body')

        for (var i=1; i < 40; i++)
            $(`<img src="trieste/Dorso.webp" id="Dorso${i}" class="dorso" width="150px" height="277px" style="position:absolute">`)
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
        var x=10, y=293, img

        // disegna la briscola trasversalmente a metà mazzo
        $('#'+this.mazzo.briscola)
        .show()
        .css({'left': (x+(277-150)/2), 'top': y, 'transform': 'rotate(90deg)', 'zIndex': -1})

        // disegna i dorsi sovrapposti, simulando il 3D
        $('img[class="dorso"]').each( function() {
            $(this).css({left: x, top: y}).show()
            x -= 0.1
            y -= 0.1
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
        img.animate( {left: this.coord[giocatore].x + indice*90, top: this.coord[giocatore].y},
                        tempo,
                        function () { // eseguita al termine dell'animazione
                            if (giocatore) {
                                var p = $(this).position()
                                $(`#${carta}`).show().css({left: p.left, top: p.top, zIndex: indice})
                                $(`#${carta}`).click(function() {partita.gioca(1,indice)})
                                if (!vuoto)
                                    $(this).hide() // nasconde il dorso (fade/ rotateY per simulare la girata?)
                            }
                            else {
                                $(this).css({zIndex: indice}) // sposta il dorso del PC al livello corretto nel ventaglio
                                if (vuoto) {
                                    $('#Dorso38').show().css({left: $(this).position().left, top: $(this).position().top, zIndex: indice})
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
    
        if (r < 0) {
            if (DEBUG) console.log(`UMANO prende ${punti} punti`)
            this.punti_me += punti
            this.di_turno = this.primo_di_mano = 1
            // anima la presa
            $(`#${this.giocate[0]}`)
                .css({zIndex: 100})
                .animate({left: this.coord[1].x, top: this.coord[1].y}, 500)
                .fadeOut()
            $(`#${this.giocate[1]}`)
                .css({zIndex: 100})
                .animate({left: this.coord[1].x, top: this.coord[1].y}, 500)
                .fadeOut()
            // pesca (l'animazione del 2° è leggermente più lenta, per distinguere visivamente i turni di pescata)
            setTimeout(this.daiCarta.bind(this), 500, 1, indici[1])
            setTimeout(this.daiCarta.bind(this), 900, 0, indici[0], 600)
        } else
        if (r > 0) {
            if (DEBUG) console.log(`PC prende ${punti} punti`)
            this.punti_pc += punti
            this.di_turno = this.primo_di_mano = 0
            $(`#${this.giocate[0]}`)
                .css({zIndex: 100})
                .animate({left: this.coord[0].x, top: this.coord[0].y}, 500)
                .fadeOut()
            $(`#${this.giocate[1]}`)
                .css({zIndex: 100})
                .animate({left: this.coord[0].x, top: this.coord[0].y}, 500)
                .fadeOut()
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
            if (this.punti_me == this.punti_pc) window.alert('Pareggio!')
            if (this.punti_me > this.punti_pc) window.alert(`${this.punti_me} a ${this.punti_pc}: hai vinto tu!`)
            if (this.punti_me < this.punti_pc) window.alert(`${this.punti_pc} a ${this.punti_me}: ho vinto io!`)
            this.riavvia()
    }
}
