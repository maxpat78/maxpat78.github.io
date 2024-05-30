//
// Gioco tradizionale della Briscola italiana
//
// (C)2024, maxpat78
//

// Costruisce un mazzo simbolico di carte regionali italiane
// mazzo_valori è ordinato per valore di presa
const mazzo_valori = "24567FCR3A" // A=Asso, F=Fante, C=Cavallo, R=Re
const mazzo_semi = "BCDS" // Bastoni, Coppe, Denari, Spade
const mazzo_punti = [0,0,0,0,0,2,3,4,10,11]

const revision = "$Revision: 1.014"

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
        var semi = ['Bastoni', 'Coppe', 'Denari', 'Spade']
        return valori[ mazzo_valori.indexOf(carta[0]) ] + ' di ' + semi[ mazzo_semi.indexOf(carta[1]) ]
    }
};



class Giocatore {
    constructor(partita, tipo='PC') {
        this.partita = partita
        this.tipo = tipo
        this.mano = []
        this.punti = 0
    }

    // prende una carta dal mazziere
    prendi_carta(carta) {
        this.mano.push(carta)
        console.log(this.tipo, 'pesca', carta)
    }
    
    // ritorna il numero di carte rimaste
    carte() { return this.mano.length }

    // seleziona una carta a caso
    algo1() {
        return Math.floor((Math.random()*this.mano.length))
    }

    // seleziona una carta con il criterio massimo beneficio, minimo danno
    algo2() {
        var p = this.partita
        var possibili = []
        // se il PC gioca primo di mano...
        if (p.primo_di_mano == 0) {
            // ...sceglie la carta di minor valore
            return this.minor_valore()
        }
        // ...altrimenti, cerca la mossa migliore
        else {
            for (var i=0; i < this.mano.length; i++)
                possibili.push( this.compara(this.mano[i], p.carte_giocate[1], p.briscola[1], 0) )
            return this.analizza2(possibili, p.briscola[1])
        }
        console.log('ATTENZIONE: algo2 risponde a caso, non dovrebbe succedere MAI!!!')
        return this.algo1()
    }

    // determina chi fa presa e quanti punti riceve, ritornando un dizionario con i dati
    compara(mia_carta, sua_carta, briscola, primo) {
        var o = {carta:mia_carta, prendo:0, prende:0, miei_punti:0, suoi_punti:0}
        // una sola briscola?
        if (mia_carta[1] == briscola && sua_carta[1] != briscola) o.prendo = 1
        else if (mia_carta[1] != briscola && sua_carta[1] == briscola) o.prendo = 0
        // semi diversi?
        else if (mia_carta[1] != sua_carta[1]) {
            if (primo) o.prendo = 1
            else o.prendo = 0
        }
        // stesso seme?
        else
            o.prendo = (mazzo_valori.indexOf(mia_carta[0]) > mazzo_valori.indexOf(sua_carta[0]))? 1 : 0
    
        if (o.prendo) {
            o.prende = o.suoi_punti = 0
            o.miei_punti = calcola_punti(mia_carta, sua_carta)
        }
        else {
            o.prende = 1
            o.suoi_punti = calcola_punti(mia_carta, sua_carta)
            o.miei_punti = 0
        }
        return o
    }

    // ritorna l'indice della migliore mossa possibile
    // miglior mossa è quella che dà più punti al PC, o meno punti all'avversario
    // conserva le briscole (maggiori), ove possibile
    analizza2(possibili, briscola) {
        var prese=[], perse=[]
        for (var i in possibili) possibili[i].prendo ? prese.push(possibili[i]) : perse.push(possibili[i])
        if (prese.length) {
            prese.sort( (a,b) => b.miei_punti - a.miei_punti ) // ordina per punti...
            prese.sort( (a,b) => {  // ...e per briscola
                if (a.carta[1] == b.carta[1]) return 0
                if (a.carta[1] == briscola[1]) return -1
                else if (b.carta[1] == briscola[1]) return 1
            })
            if (prese.length > 1) {
                // se la prima presa è con una briscola e la seconda no, ma dà anch'essa punti, la preferisce
                if (prese[0].carta[1] == briscola[1] && (prese[1].carta[1] != briscola[1] && prese[1].miei_punti > 0))
                    [prese[0], prese[1]] = [prese[1], prese[0]]
            }
            console.log('Prese ordinate (dalla più vantaggiosa):', prese)
        }
        // di base, compara i punti lasciati all'avversario
        //~ perse.sort( (a,b) => a.suoi_punti - b.suoi_punti)
        // un carico perso è considerato di maggior valore di una briscola minore (fino al Re)
        perse.sort( (a,b) => (a.suoi_punti + (a.carta[1]==briscola[1]? 5:0)) - (b.suoi_punti + (b.carta[1]==briscola[1]? 5:0)))
        console.log('Lasciate ordinate (dalla più vantaggiosa):', perse)
        if (prese.length) {
            // lascio, se prendere non mi avvantaggia e lasciare lo avvantaggia poco (2 punti max)
            if (perse.length && prese[0].miei_punti == 0 && perse[0].suoi_punti < 3)
                return possibili.indexOf(perse[0])
            return possibili.indexOf(prese[0])
        }
        return possibili.indexOf(perse[0])
    }

    // gioca una carta (-1 = gioco automatico del PC), se possibile
    gioca(carta=-1) {
        if (this.mano.length == 0) return
        if (carta < 0) carta = this.algo2()
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
        console.log(c, 'è la carta minore fra', this.mano)
        return this.mano.indexOf(c)
    }
}


class Partita {
    constructor() {
        // elementi grafici nella pagina
        this.mano_pc = document.querySelectorAll('#Giocatore1 > img')
        this.mano_umano = document.querySelectorAll('#Giocatore2 > img')
        this.mano_banco = document.querySelectorAll('#Banco > img')
        this.load(1)
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
        if (!first && this.mani.length < 40) return
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
        for (var i in this.giocatori) this.giocatori[i].mano = this.mazzo.prendi(3)
    
        // mostra le carte
        for (const img of this.mano_pc) img.src = this.img['Dorso'].src
        for (var i=0; i < 3; i++) { 
            this.mano_umano[i].src = this.img[this.giocatori[1].mano[i]].src // carica la carta
            this.mano_umano[i].setAttribute('onclick', `partita.gioca(1,${i})`) // assegna un evento onclick
        }
        console.log('La briscola è ' + this.mazzo.nome(this.briscola).split(' ').slice(-1))
        document.getElementById('riga1').innerHTML = `La briscola è: ${this.mazzo.nome(this.briscola)}.`
    }

    // esegue la giocata in partita aggiornando la grafica di mani e banco
    gioca(giocatore, carta=-1) {
        var giocata
    
        // previene l'esecuzione se sono state giocate tutte le mani    
        if (this.mani.length == 40) return
    
        if (giocatore == 1) {
            // ritorna se il giocatore ha cliccato quando non era di turno
            if (this.di_turno != 1) return
            this.di_turno = 0 // inverte il turno
            giocata = this.giocatori[1].gioca(carta)
            console.log('UMANO gioca', this.mazzo.nome(giocata.nome))
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
            console.log('PC gioca', this.mazzo.nome(giocata.nome))
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
            //~ console.log('compara(',this.carte_giocate[0], this.carte_giocate[1],') ritorna', r)
            var punti = calcola_punti(this.carte_giocate[0], this.carte_giocate[1])
            // se è maggiore la carta del PC, o era lui di mano... 
            if (r > 0 || (r==0 && this.primo_di_mano==0)) {
                this.giocatori[0].punti += punti
                this.primo_di_mano = this.di_turno = 0
                console.log('PC prende', punti, 'punti')
                this.info(`Prende PC! ${this.giocatori[0].punti} a ${this.giocatori[1].punti}.`)
                if (! this.mazzo.vuoto()) {
                    this.giocatori[0].prendi_carta(this.mazzo.pesca())
                    this.giocatori[1].prendi_carta(this.mazzo.pesca())
                }
            }
            // se è maggiore la carta dell'umano, o era lui di mano... 
            else if (r < 0 || (r==0 && this.primo_di_mano==1)) {
                this.giocatori[1].punti += punti
                this.primo_di_mano = this.di_turno = 1
                console.log('UMANO prende', punti, 'punti')
                this.info(`Prendi TU! ${this.giocatori[1].punti} a ${this.giocatori[0].punti}.`)
                if (! this.mazzo.vuoto()) {
                    this.giocatori[1].prendi_carta(this.mazzo.pesca())
                    this.giocatori[0].prendi_carta(this.mazzo.pesca())
                }
            }
            document.getElementById('riga3').innerHTML = `${this.mazzo.pila.length} carte nel mazzo.`
            this.carte_giocate = []
            console.log('Carte restanti nel mazzo: ', this.mazzo.pila.length, ' Mani giocate:', this.mani.length/2)
            setTimeout(this.rinfresca_carte.bind(this), 1500)
            if (this.mani.length == 40) {
                this.primo_di_mano = this.di_turno = -1
                var msg = "Smazzata terminata. "
                if (this.giocatori[0].punti ==  this.giocatori[1].punti)
                    msg += "Parità!"
                else if (this.giocatori[0].punti >  this.giocatori[1].punti)
                    msg += `Vince PC: ${this.giocatori[0].punti} a ${this.giocatori[1].punti}.`
                else
                    msg += `Vinci TU: ${this.giocatori[1].punti} a ${this.giocatori[0].punti}.`
                this.info(msg)
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
        for (var i=0; i < 3; i++) {
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
};
