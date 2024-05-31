//
// Gioco della Maria(zz|nn)a italiana
//
// (C)2024, maxpat78
//

// Costruisce un mazzo simbolico di carte regionali italiane
// mazzo_valori è ordinato per valore di presa
const mazzo_valori = "24567FCR3A" // A=Asso, F=Fante, C=Cavallo, R=Re
const mazzo_semi = "BCDS" // Bastoni, Coppe, Denari, Spade
const mazzo_punti = [0,0,0,0,0,2,3,4,10,11]

const revision = "$Revision: 1.000"
const DEBUG = 1



// ritorna un elemento casuale da una lista (senza rimuoverlo)
function una_carta(L) {
    return L[Math.floor((Math.random()*L.length))]
}

// calcola i punti della coppia di carte
function calcola_punti(carta1, carta2) {
    return mazzo_punti[mazzo_valori.indexOf(carta1[0])] + mazzo_punti[mazzo_valori.indexOf(carta2[0])]
}



class Mazzo {
    constructor() {
        this.carte = 40
        this.pila = []
        for (var i=0; i<4; i++) {
            for (var j=0; j<10; j++) {
                this.pila.push(mazzo_valori[j]+mazzo_semi[i])
            }
        }
        this.mescola()
    }

    mescola() {
        var pila = []
        for (var i=0; i < this.carte; i++) {
            // estrae una carta a caso
            var carta = this.pila[ Math.floor((Math.random()*this.pila.length)) ]
            pila.push(carta)
            // la rimuove dalla pila originale
            this.pila = this.pila.filter(e => e !== carta)
        }
        // rimpiazza la pila con quella mescolata
        this.pila = pila
    }

    // pesca una carta, rimuovendola dalla pila
    pesca() { return this.pila.shift() }

    // prende n carte dalla cima della pila
    prendi(n) {
        var r = []
        while (n--) r.push(this.pila.shift())
        return r
    }

    vuoto() { return (this.pila.length == 0) }

    // ritorna la carta di briscola (ultima del mazzo)
    briscola() { return this.pila[this.pila.length-1] }

    // mostra il nome completo della carta simbolica
    nome(carta) {
        var valori = ['Due', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Fante', 'Cavallo', 'Re', 'Tre', 'Asso']
        var semi = ['Bastoni', 'Coppe', 'Danari', 'Spade']
        return valori[ mazzo_valori.indexOf(carta[0]) ] + ' di ' + semi[ mazzo_semi.indexOf(carta[1]) ]
    }
};



class Giocatore {
    constructor(partita, tipo='PC') {
        this.partita = partita
        this.tipo = tipo
        this.mano = []
        this.punti = 0
        this.mariazze = [] // mariazze trovate
        this.mariazze_accusate = [] // mariazze già accusate
        this.punti_accusa = 0 // punti di accusa per la mariazza
    }

    // prende una carta dal mazziere
    prendi_carta(carta) {
        this.mano.push(carta)
        if (DEBUG) console.log(this.tipo, 'pesca', carta)
        this.cerca_mariazze()
    }
    
    // ritorna il numero di carte rimaste
    carte() { return this.mano.length }

    cerca_mariazze() {
        var m = this.mano
        this.mariazze = []
        if (m.includes('RD') && m.includes('CD') && !this.mariazze_accusate.includes('D')) this.mariazze.push('D')
        if (m.includes('RB') && m.includes('CB') && !this.mariazze_accusate.includes('B')) this.mariazze.push('B')
        if (m.includes('RC') && m.includes('CC') && !this.mariazze_accusate.includes('C')) this.mariazze.push('C')
        if (m.includes('RS') && m.includes('CS') && !this.mariazze_accusate.includes('S')) this.mariazze.push('S')
        if (this.mariazze.length && this.tipo != 'PC')
            document.querySelector("#accusa").style.visibility = 'visible'
        if (DEBUG && this.mariazze.length) console.log(this.tipo, 'ha', this.mariazze.length,'mariazze')
    }

    accusa() {
        var semi = ['Bastoni', 'Coppe', 'Danari', 'Spade']
        // 20 punti per ogni mariazza, 40 se è di briscola: subito se di mano
        for (var i=0; i < this.mariazze.length; i++) {
            if (DEBUG) console.log(this.tipo, 'accusa mariazza di', semi[mazzo_semi.indexOf(this.mariazze[i])])
            if (this.tipo == 'PC')
                window.alert('PC accusa mariazza di ' + semi[mazzo_semi.indexOf(this.mariazze[i])])
            this.mariazze_accusate.push(this.mariazze[i])
            if (this.partita.primo_di_mano == this.partita.giocatori.indexOf(this)) {
                if (DEBUG) console.log(this.tipo, 'prende i punti di accusa')
                this.punti += 20
                if (this.mariazze[i] == this.partita.briscola[1]) this.punti += 20
            } else {
                this.punti_accusa += 20
                if (this.mariazze[i] == this.partita.briscola[1]) this.punti_accusa += 20
            }
        }
    }

    // seleziona una carta a caso
    algo1() {
        return Math.floor((Math.random()*this.mano.length))
    }

    // seleziona una carta con il criterio massimo beneficio, minimo danno
    algo2() {
        var p = this.partita
        var possibili = []
        if (p.mazzo.pila.length == 2) this.analizza_finale()
        // se il PC gioca primo di mano...
        if (p.primo_di_mano == 0) {
            // ...sceglie la carta di minor valore
            return this.minor_valore()
        }
        // ...altrimenti, cerca la mossa migliore
        else {
            for (var i=0; i < this.mano.length; i++)
                possibili.push( this.compara2(this.mano[i], p.carte_giocate[1], p.briscola[1], 0) )
            return this.analizza3(possibili)
        }
        if (DEBUG) console.log('ATTENZIONE: algo2 risponde a caso, non dovrebbe succedere MAI!!!')
        return this.algo1()
    }

    analizza_finale() {
        // Ricordando tutte le carte prese e restandone 2 nel mazzo, si può
        // stabilire quali siano le 2 dell'avversario e la penultima di mazzo
        if (DEBUG) console.log('Analisi della quartultima')
        var carta_nota = this.partita.briscola
        // ignote, ma conoscibili, sono le carte in mano all'avversario e la penultima da pescare
        var carte_ignote = [].concat(this.partita.giocatori[1].mano, this.partita.mazzo.pila.slice(-2,-1))
        console.log('carta nota:', carta_nota)
        console.log('carte ignote:', carte_ignote)
        // criteri per stabilire se prendo la briscola finale:
        // è alta? A, 3, R... F?
        // avrò più briscole io?
        // cosa sacrifico?
        if (this.partita.primo_di_mano == 0) {
        }
        else {
        }
    }

    // determina chi fa presa e quanti punti riceve, ritornando un dizionario con i dati
    compara2(mia_carta, sua_carta, briscola, primo) {
        // prende = 1 (io), 0 (lui)
        // briscola = se mia_carta è una briscola
        var o = {carta:mia_carta, prende:0, punti:0, guadagno:0, briscola:mia_carta[1]==briscola}
        o.punti = calcola_punti(mia_carta, sua_carta)
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
            o.prende = (mazzo_valori.indexOf(mia_carta[0]) > mazzo_valori.indexOf(sua_carta[0]))? 1 : 0
        // calcola il guadagno come punti presi da lui o persi da me
        if (o.prende)
            o.guadagno = calcola_punti('2S', sua_carta)
        else
            o.guadagno = calcola_punti('2S', mia_carta)
        return o
    }

    // ritorna l'indice della migliore mossa possibile
    // miglior mossa è quella che dà più punti al PC, o meno punti all'avversario
    // tenta di conservare le briscole
    analizza3(possibili) {
        if (DEBUG) console.log('mosse possibili:', possibili)
        var prese=[], perse=[]
        var miglior_punto = null
        var miglior_senza = null

        // separa prese e lasciate
        for (var i in possibili) possibili[i].prende ? prese.push(possibili[i]) : perse.push(possibili[i])

        if (prese.length) {
            var con_punti = prese.filter((a) => a.punti)
            var senza_briscola = prese.filter((a) => !a.briscola)
            if (con_punti.length) {
                con_punti.sort((a,b) => b.punti - a.punti) // ordina per punti
                miglior_punto = con_punti[0]
                con_punti.sort((a,b) => { // per briscola
                    if (a.briscola && !b.briscola) return 1
                    if (b.briscola && !a.briscola) return -1
                    return mazzo_valori.indexOf(a.carta[0]) - mazzo_valori.indexOf(b.carta[0])
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
                return possibili.indexOf(miglior_senza)
            // preferisce la presa che dà punti e o non è di briscola o, essendolo, dà un valore aggiunto
            if (miglior_punto && miglior_punto.punti && (!miglior_punto.briscola || miglior_punto.guadagno))
                return possibili.indexOf(miglior_punto)
        }
        // se non può lasciare...
        if (!perse.length) {
            if (miglior_senza) return possibili.indexOf(miglior_senza)
            if (miglior_punto) return possibili.indexOf(miglior_punto)
            return possibili.indexOf(prese[0])
        }

        // come valutare la perdita di una briscola?
        perse.sort( (a,b) => (a.guadagno + (a.briscola? 2:0)) - (b.guadagno + (b.briscola? 2:0)))
        if (DEBUG) console.log('perse:', perse)
        // prende anche se la carta lasciata darebbe punti extra
        if (prese.length && perse[0].guadagno)
            return possibili.indexOf(miglior_punto? miglior_punto : prese[0])
        // altrimenti, lascia
        return possibili.indexOf(perse[0])
    }

    // gioca una carta (-1 = gioco automatico del PC), se possibile
    gioca(carta=-1) {
        if (this.mano.length == 0) return
        if (carta < 0) { 
            // il PC accusa automaticamente eventuali mariazze
            if (this.mariazze.length) this.accusa()
            carta = this.algo2()
        }
        var nome_carta = this.mano[carta]
        this.mano.splice(carta, 1) // rimuove la carta dalla mano
        return {i: carta, nome: nome_carta}
    }
    
    // ritorna il valore di una carta, +5 se è di briscola
    // se puro=1, non distingue le briscole
    valore(carta, puro=0) {
        var valore = mazzo_punti[ mazzo_valori.indexOf(carta[0]) ]
        if (carta[1] == this.partita.briscola[1] && !puro) valore += 5
        return valore
    }
    
    // determina quale delle carte in mano ha minor valore
    minor_valore() {
        var c, c1, c2
        this.mano.sort( (a,b) => this.valore(a,1) - this.valore(b,1) )
        c1 = this.mano[0]
        this.mano.sort( (a,b) => this.valore(a) - this.valore(b) )
        c2 = this.mano[0]
        c = c1
        if (c1[1] == this.partita.briscola[1]) c = c2
        if (DEBUG) console.log(c, 'è la carta minore fra', this.mano)
        return this.mano.indexOf(c)
    }
}


class Partita {
    constructor() {
        // elementi grafici nella pagina
        this.mano_pc = document.querySelectorAll('#Giocatore1 > img')
        this.mano_umano = document.querySelectorAll('#Giocatore2 > img')
        this.mano_banco = document.querySelectorAll('#Banco > img')
        // BxH dell'area visibile del browser
        var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        console.log(width, height)
        // porzione utilizzabile dalle carte (3 carte, 3 righe)
        var W = (width - 40) / 5
        var H = (height - 120) / 3
        // rapporto tra la dim. massima utilizzabile per una carta, e la carta
        var ratio = Math.min(W/300, H/554)
        console.log(W, H, ratio)
        for (var i=0; i<5; i++) {
            this.mano_pc[i].width = 300*ratio
            this.mano_pc[i].height = 554*ratio
        }
        for (var i=0; i<2; i++) {
            this.mano_banco[i].width = 300*ratio
            this.mano_banco[i].height = 554*ratio
        }
        for (var i=0; i<5; i++) {
            this.mano_umano[i].width = 300*ratio
            this.mano_umano[i].height = 554*ratio
        }
        this.load(1)
        // neanche a questo punto, .height/.naturalHeight ecc. sono validi!
        //console.log(this.img['Dorso'].naturalHeight)
    }

    gfx_load() {
        // precarica le immagini di tutte le carte, la prima volta
        this.img = []
        this.img['Dorso'] = new Image()
        this.img['Dorso'].src = 'trieste/Dorso.webp'

        for (var i of this.mazzo.pila) {
            this.img[i] = new Image()
            this.img[i].src = `trieste/${i}.webp`
        }
    }

    load(first=0) {
        if (!first && !this.finita) return
        this.finita = 0
        this.mazzo = new Mazzo(first)
        if (first) this.gfx_load()
        this.briscola = this.mazzo.briscola() // carta di briscola (ultima del mazzo)
        this.di_turno = 1 // chi deve giocare (1=umano)
        this.primo_di_mano = 1 // chi era primo di mano
        this.carte_giocate = [] // le 2 carte giocate in una mano
        this.mani = [] // cronologia delle mani della smazzata

        // crea i 2 giocatori, PC e umano, e dà le carte
        this.giocatori = []
        this.giocatori.push(new Giocatore(this, 'PC')) // computer
        this.giocatori.push(new Giocatore(this,'UMANO')) // umano
        for (var i in this.giocatori) {
            this.giocatori[i].mano = this.mazzo.prendi(5)
            //~ this.giocatori[1].mano[3] = 'RD'
            //~ this.giocatori[1].mano[4] = 'CD'
            this.giocatori[i].cerca_mariazze()
        }

        // mostra le carte
        for (const img of this.mano_pc) img.src = this.img['Dorso'].src
        for (var i=0; i < 5; i++) { 
            this.mano_umano[i].src = this.img[this.giocatori[1].mano[i]].src // carica la carta
            this.mano_umano[i].setAttribute('onclick', `partita.gioca(1,${i})`) // assegna un evento onclick
        }
        if (DEBUG) console.log('La briscola è ' + this.mazzo.nome(this.briscola).split(' ').slice(-1))
        document.getElementById('riga1').innerHTML = `La briscola è: ${this.mazzo.nome(this.briscola)}.`
        document.getElementById('riga3').innerHTML = `${this.mazzo.pila.length} carte nel mazzo.`
    }

    // esegue la giocata in partita aggiornando la grafica di mani e banco
    gioca(giocatore, carta=-1) {
        var giocata
    
        // previene l'esecuzione se sono state giocate tutte le mani    
        if (this.finita) return
    
        if (giocatore == 1) {
            // ritorna se il giocatore ha cliccato quando non era di turno
            if (this.di_turno != 1) return
            this.di_turno = 0 // inverte il turno
            giocata = this.giocatori[1].gioca(carta)
            if (DEBUG) console.log('UMANO gioca', this.mazzo.nome(giocata.nome))
            // aggiorna il banco
            this.carte_giocate[1] = giocata.nome
            // registra la giocata nella cronologia
            this.mani.push({giocatore:'Umano', giocata: giocata})
            // aggiorna la grafica di mano e banco
            this.mano_umano[giocata.i].style.visibility = 'hidden'
            this.mano_umano[giocata.i].src = ''
            this.mano_banco[0].src = this.img[giocata.nome].src
            this.mano_banco[0].style.visibility = 'visible'
            // fa giocare il PC se l'umano ha fatto la prima mossa
            if (this.primo_di_mano == 1) this.gioca(0)
        }
        else {
            this.di_turno = 1
            giocata = this.giocatori[0].gioca(carta)
            if (DEBUG) console.log('PC gioca', this.mazzo.nome(giocata.nome))
            this.mani.push({giocatore:'PC', giocata: giocata})
            this.carte_giocate[0] = giocata.nome
            this.mano_pc[giocata.i].style.visibility = 'hidden'
            this.mano_pc[giocata.i].src = ''
            this.mano_banco[1].src = this.img[giocata.nome].src
            this.mano_banco[1].style.visibility = 'visible'
        }
    
        // se ambedue hanno giocato...
        if (this.carte_giocate.length == 2) {
            var r = this.compara(this.carte_giocate[0], this.carte_giocate[1])
            //~ if (DEBUG) console.log('compara(',this.carte_giocate[0], this.carte_giocate[1],') ritorna', r)
            var punti = calcola_punti(this.carte_giocate[0], this.carte_giocate[1])
            // se è maggiore la carta del PC, o era lui di mano... 
            if (r > 0 || (r==0 && this.primo_di_mano==0)) {
                this.giocatori[0].punti += punti
                // aggiunge gli eventuali punti di accusa
                if (DEBUG && this.giocatori[0].punti_accusa) console.log('PC prende', this.giocatori[0].punti_accusa, 'punti di accusa')
                this.giocatori[0].punti += this.giocatori[0].punti_accusa
                this.giocatori[0].punti_accusa = 0
                this.primo_di_mano = this.di_turno = 0
                if (DEBUG) console.log('PC prende', punti, 'punti')
                this.info(`Prende PC! ${this.giocatori[0].punti} a ${this.giocatori[1].punti}.`)
                if (! this.mazzo.vuoto()) {
                    this.giocatori[0].prendi_carta(this.mazzo.pesca())
                    this.giocatori[1].prendi_carta(this.mazzo.pesca())
                }
            }
            // se è maggiore la carta dell'umano, o era lui di mano... 
            else if (r < 0 || (r==0 && this.primo_di_mano==1)) {
                this.giocatori[1].punti += punti
                // aggiunge gli eventuali punti di accusa
                if (DEBUG && this.giocatori[1].punti_accusa) console.log('UMANO prende', this.giocatori[1].punti_accusa, 'punti di accusa')
                this.giocatori[1].punti += this.giocatori[1].punti_accusa
                this.giocatori[1].punti_accusa = 0
                this.primo_di_mano = this.di_turno = 1
                if (DEBUG) console.log('UMANO prende', punti, 'punti')
                this.info(`Prendi TU! ${this.giocatori[1].punti} a ${this.giocatori[0].punti}.`)
                if (! this.mazzo.vuoto()) {
                    this.giocatori[1].prendi_carta(this.mazzo.pesca())
                    this.giocatori[0].prendi_carta(this.mazzo.pesca())
                }
            }
            document.getElementById('riga3').innerHTML = `${this.mazzo.pila.length} carte nel mazzo.`
            this.carte_giocate = []
            if (DEBUG) console.log('Carte restanti nel mazzo: ', this.mazzo.pila.length, ' Mani giocate:', this.mani.length/2)
            setTimeout(this.rinfresca_carte.bind(this), 1500)
            // termina subito se un giocatore raggiunge i 41 punti
            if (this.mani.length == 40 || this.giocatori[0].punti > 40 || this.giocatori[1].punti > 40) {
                this.finita = 1
                this.primo_di_mano = this.di_turno = -1
                var msg = "Smazzata terminata. "
                if (this.giocatori[0].punti ==  this.giocatori[1].punti)
                    msg += "Parità!"
                else if (this.giocatori[0].punti >  this.giocatori[1].punti)
                    msg += `Vince PC: ${this.giocatori[0].punti} a ${this.giocatori[1].punti}.`
                else
                    msg += `Vinci TU: ${this.giocatori[1].punti} a ${this.giocatori[0].punti}.`
                this.info(msg)
                //~ this.giocatori[0].mano =[]
                //~ this.giocatori[1].mano =[]
                return
            }
            // se eseguito PRIMA di rinfresca_carte, la carta giocata resta invisibile
            if (this.primo_di_mano == 0) setTimeout(this.gioca.bind(this), 1510, 0)
        }
    }

    // ritorna un numero positivo se carta1 prende carta2, negativo in caso contrario
    // tiene conto del seme di briscola
    // ritorna zero se le carte sono di seme diverso
    compara(carta1, carta2) {
        // una sola briscola?
        if (carta1[1] == this.briscola[1] && carta2[1] != this.briscola[1]) return 1
        if (carta1[1] != this.briscola[1] && carta2[1] == this.briscola[1]) return -1
        // semi diversi?
        if (carta1[1] != carta2[1]) return 0
        // semi uguali: compara i valori di presa
        return mazzo_valori.indexOf(carta1[0]) - mazzo_valori.indexOf(carta2[0]) 
    }

    // aggiorna la grafica delle carte in mano e sul banco
    rinfresca_carte() {
        // nasconde la carta giocata dall'umano
        this.mano_banco[0].style.visibility = 'hidden'
        this.mano_banco[0].src = ''
        // nasconde la carta giocata dal PC se è di mano o sono finite le carte
        if (this.primo_di_mano == 1 || ! this.giocatori[0].mano.length)
            this.mano_banco[1].style.visibility = 'hidden'
            this.mano_banco[1].src = ''
        // rinfresca le mani
        for (var i=0; i < 5; i++) {
            var m
            m = this.giocatori[0].mano[i]
            this.mano_pc[i].src = (m != undefined)? this.img['Dorso'].src : ''
            this.mano_pc[i].style.visibility = (m != undefined)? 'visible':'hidden'
            m = this.giocatori[1].mano[i]
            if (m != undefined) {
                this.mano_umano[i].src =  this.img[m].src // carica il file della carta
                this.mano_umano[i].style.visibility = 'visible'
            }
            else
                this.mano_umano[i].style.visibility = 'hidden'
        }
    }

    info(s) {
        document.getElementById('riga2').innerHTML = s
    }

    accusa() {
        document.querySelector("#accusa").style.visibility = 'hidden'
        this.giocatori[1].accusa()
    }

    scambia() {
        document.querySelector("#scambia").style.visibility = 'hidden'
    }
};
