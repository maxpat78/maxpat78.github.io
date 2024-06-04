//
// Gioco tradizionale della Briscola italiana
//
// (C)2024, maxpat78
//

const revisione = "$Revisione: 1.102"
DEBUG = 1

// costruisce un mazzo simbolico di 40 carte regionali italiane
// personalizzato per il gioco della Briscola o della Marianna
class Mazzo {
    static mazzo_semi = "BCDS" // Bastoni, Coppe, Denari, Spade
    // mazzo_valori è qui ordinato per valore di presa nella Briscola
    static mazzo_valori = "24567FCR3A" // A=Asso, F=Fante, C=Cavallo, R=Re
    // mazzo_punti è qui ordinato per punti nella Briscola
    static mazzo_punti = [0,0,0,0,0,2,3,4,10,11]
    static nome_valori = ['Due', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Fante', 'Cavallo', 'Re', 'Tre', 'Asso']
    static nome_semi = ['Bastoni', 'Coppe', 'Danari', 'Spade']

    constructor() {
        this.mazzo = []
        for (let i in Mazzo.mazzo_semi)
            for (let j in Mazzo.mazzo_valori)
                this.mazzo.push(Mazzo.mazzo_valori[j]+Mazzo.mazzo_semi[i])
        this.mazzo.sort((a,b) => 0.5 - Math.random()) // ordina a caso (=mescola)
        this.briscola = this.mazzo.slice(-1)[0] // la carta di briscola sarà l'ultima pescata nel mazzo riordinato
        // per la Marianna senza briscola, usare 'NN'
        if (DEBUG) console.log(`La briscola è ${this.seme(this.briscola)}`)
    }

    // pesca una carta, rimuovendola dalla pila
    pesca() { return this.mazzo.shift() }

    vuoto() { return this.mazzo.length == 0 }

    // mostra il nome completo della carta
    nome(carta) {
        return Mazzo.nome_valori[ Mazzo.mazzo_valori.indexOf(carta[0]) ] + ' di ' + Mazzo.nome_semi[ Mazzo.mazzo_semi.indexOf(carta[1]) ]
    }

    // mostra il nome del seme della carta
    seme(carta) { return Mazzo.nome_semi[ Mazzo.mazzo_semi.indexOf(carta[1]) ] }

    // ritorna i punti corrispondenti alla carta
    punti(carta) { return Mazzo.mazzo_punti[Mazzo.mazzo_valori.indexOf(carta[0])] }

    // ritorna un numero positivo se carta1 prende carta2, negativo in caso contrario
    // tiene conto del seme di briscola
    // se i semi sono diversi, prende la carta giocata prima
    prende(carta1, carta2, prima_giocata) {
        // una sola briscola?
        if (carta1[1] == this.briscola[1] && carta2[1] != this.briscola[1]) return 1
        if (carta1[1] != this.briscola[1] && carta2[1] == this.briscola[1]) return -1
        // semi diversi?
        if (carta1[1] != carta2[1]) return (prima_giocata==0)? 1 : -1
        // semi uguali: compara i valori di presa
        return Mazzo.mazzo_valori.indexOf(carta1[0]) - Mazzo.mazzo_valori.indexOf(carta2[0]) 
    }
};


class Giocatore {
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
            //~ o.prende = (Mazzo.mazzo_valori.indexOf(mia_carta[0]) > Mazzo.mazzo_valori.indexOf(sua_carta[0]))? 1 : 0
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
    analizza3(possibili) {
        if (DEBUG) console.log('mosse possibili:', possibili)
        var prese=[], perse=[]
        var miglior_punto = null
        var miglior_senza = null
        var mazzo_valori = "24567FCR3A" // A=Asso, F=Fante, C=Cavallo, R=Re
        var mano = this.partita.mani[0]
    
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
};


class Tavolo {
    constructor() {
        this.width = 0
        this.height = 0
        this.imgs = [] // immagini di ogni carta del mazzo
        this.gfx_mazzo = [] // immagini dei dorsi e della briscola componenti il mazzo
        this.gfx_manopc = [] // immagini della mano del PC
        this.gfx_manome = [] // immagini della mano umana
        this.gfx_banco = [] // immagini del banco
        this.mazzo = new Mazzo()
        this.mani = [[], []] // array di array con le 3 carte simboliche in mano (0=PC, 1=umano)
        this.giocate = [] // carte giocate sul banco (0=PC, 1=umano)
        this.gfx_load = 0 // indica se le carte sono state completamente caricate
        this.di_turno = 1 // chi deve fare la mossa corrente (0=PC, 1=umano)
        this.primo_di_mano = 1 // chi era primo di mano (0=PC, 1=umano)
        this.carte_giocate = [] // le 2 carte giocate in una mano
        this.cronologia = [] // cronologia delle mani della smazzata
        this.giocatore_pc = new Giocatore()
        this.punti_pc = 0
        this.punti_me = 0
        this.animazione = 0 // se è in corso un'animazione
        this.carica_carte()
    }

    avvia() {
        this.gfx_mazzo = [] // immagini dei dorsi e della briscola componenti il mazzo
        this.gfx_manopc = [] // immagini della mano del PC
        this.gfx_manome = [] // immagini della mano umana
        this.gfx_banco = [] // immagini del banco
        this.mazzo = new Mazzo()
        this.mani = [[], []] // array di array con le 3 carte simboliche in mano (0=PC, 1=umano)
        this.giocate = [] // carte giocate sul banco (0=PC, 1=umano)
        this.di_turno = 1 // chi deve fare la mossa corrente (0=PC, 1=umano)
        this.primo_di_mano = 1 // chi era primo di mano (0=PC, 1=umano)
        this.carte_giocate = [] // le 2 carte giocate in una mano
        this.cronologia = [] // cronologia delle mani della smazzata
        this.giocatore_pc = new Giocatore()
        this.punti_pc = 0
        this.punti_me = 0
        this.animazione = 0 // se è in corso un'animazione
        document.querySelector('#tavolo').replaceChildren()
        this.disegna()
    }

    onLoad() {
        if (this.gfx_load++ < 40) return
        this.disegna()
    }

    // precarica le immagini di tutte le carte, la prima volta
    carica_carte() {
        for (var i of this.mazzo.mazzo.concat('Dorso')) {
            this.imgs[i] = new Image()
            this.imgs[i].onload = this.imgs[i].onerror = this.onLoad.bind(this)
            this.imgs[i].src = `trieste/${i}.webp`
        }
    }

    disegna() {
        if (DEBUG) console.log('Dorso:', this.imgs['Dorso'].width, this.imgs['Dorso'].height)
        // area visibile del browser
        this.width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
        this.height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
        // stima dell'area occupata dal tavolo con le carte a pieno formato
        var max_width = 1400
        var max_height = 1884
        // fattore di scala delle carte
        this.ratio = Math.min(Math.min(max_width,this.width)/Math.max(max_width,this.width), Math.min(max_height,this.height)/Math.max(max_height,this.height))
        this.ratio = Math.floor(this.ratio*10)/10
        if (DEBUG) console.log('width, height, ratio', this.width, this.height,this.ratio)
        this.disegnaMazzo()
        this.disegnaCarte()
        this.daiCarte()
    
    }

    fill_div(div) {
        div.style.position='absolute'
        div.style.color='white'
        div.style.backgroundColor='red'
        div.style.fontWeight='bold'
        div.style.width='fit-content'
        div.style.alignContent='center'
        div.style.fontFamily='Arial'
        div.style.zIndex = 100
        document.querySelector('#tavolo').appendChild(div)
    }

    disegnaMazzo() {
        // posizione iniziale
        var x = this.width/24, y = this.height/3
        if (DEBUG) console.log('X Y mazzo:',x,y)

        // disegna la briscola trasversalmente a metà mazzo
        var img = new Image()
        img.src = `trieste/${this.mazzo.briscola}.webp`
        img.width *= this.ratio
        img.height *= this.ratio
        img.style.transform = 'rotate(90deg)'
        img.style.position = 'absolute'
        img.style.left = (x+(img.height-img.width)/2)+'px'
        img.style.top = y+'px'
        if (DEBUG) console.log('.left .top briscola:',img.style.left,img.style.top)
        this.gfx_mazzo.push(img) // primo elemento
        document.querySelector('#tavolo').appendChild(img)

        // disegna i dorsi soprastanti, simulando il 3D
        for (var i=0; i < 39; i++) {
            img = new Image()
            img.src = 'trieste/Dorso.webp'
            img.width *= this.ratio
            img.height *= this.ratio
            img.style.position = 'absolute'
            img.style.left = x+'px'
            img.style.top = y+'px'
            if (DEBUG) console.log('.left .top dorso:',x,y)
            x += 0.1
            y += 0.1
            this.gfx_mazzo.push(img)
            document.querySelector('#tavolo').appendChild(img)
        }
    
        // disegna un div informativo con il numero di carte restanti
        img = this.gfx_mazzo.slice(-1)[0]
        var div = document.createElement('div')
        div.id='carte'
        div.style.left = `${img.x+8}px`
        div.style.top = `${img.y+8}px`
        div.innerHTML = this.mazzo.mazzo.length
        this.fill_div(div)
    }

    // aggiorna la sovraimpressione sul mazzo con il numero di carte restanti e i punti
    disegnaRestanti() {
        document.querySelector('#punti_pc').innerHTML = this.punti_pc
        document.querySelector('#punti_me').innerHTML = this.punti_me
    
        var len = this.mazzo.mazzo.length
        var img = this.gfx_mazzo.slice(-1)[0]
        var div = document.querySelector('#carte')
        if (!len) {
            div.style.visibility = 'hidden'
            return
        }
        div.style.left = `${img.x+8}px`
        div.style.top = `${img.y+8}px`
        div.innerHTML = len
    }

    disegnaCarte() {
        // posizioni delle mani e del banco
        var x_pc = this.gfx_mazzo[1].x + 2*this.gfx_mazzo[1].width
        var y_pc = this.gfx_mazzo[1].y - this.gfx_mazzo[1].height*1.2
    
        var x_me = x_pc
        var y_me = this.gfx_mazzo[1].y + this.gfx_mazzo[1].height*1.2
    
        var x_banco = x_pc + 0.6*this.gfx_mazzo[1].width
        var y_banco = this.gfx_mazzo[1].y
    
        // aggiunge gli elementi grafici per mani e banco nelle posizioni volute
        for(var i=0; i<3; i++) {
            var img = new Image()
            img.width *= this.ratio
            img.height *= this.ratio
            img.style.visibility = 'hidden'
            img.style.position = 'absolute'
            img.style.left = x_pc+'px'
            img.style.top = y_pc+'px'
            x_pc += this.gfx_mazzo[1].width*0.6
            this.gfx_manopc.push(img)
            document.querySelector('#tavolo').appendChild(img)
        }
    
        for(var i=0; i<3; i++) {
            var img = new Image()
            img.width *= this.ratio
            img.height *= this.ratio
            img.style.position = 'absolute'
            img.style.left = x_me+'px'
            img.style.top = y_me+'px'
            x_me += this.gfx_mazzo[1].width*0.6
            this.gfx_manome.push(img)
            document.querySelector('#tavolo').appendChild(img)
        }
    
        for(var i=0; i<2; i++) {
            var img = new Image()
            img.width *= this.ratio
            img.height *= this.ratio
            img.style.position = 'absolute'
            img.style.left = x_banco+'px'
            img.style.top = y_banco+'px'
            x_banco += this.gfx_mazzo[1].width*0.6
            this.gfx_banco.push(img)
            document.querySelector('#tavolo').appendChild(img)
        }
    
        // disegna div informativi con i punti dei giocatori
        img = this.gfx_manopc.slice(-1)[0]
        var div = document.createElement('div')
        div.id='punti_pc'
        div.style.left = `${img.x+this.gfx_mazzo[1].width+8}px`
        div.style.top = `${img.y+8}px`
        div.innerHTML = this.punti_pc
        this.fill_div(div)
        img = this.gfx_manome.slice(-1)[0]
        div = document.createElement('div')
        div.id='punti_me'
        div.style.left = `${img.x+this.gfx_mazzo[1].width+8}px`
        div.style.top = `${img.y+8}px`
        div.innerHTML = this.punti_me
        this.fill_div(div)
    }

    // dà una carta al giocatore (0=PC, 1=umano). indice è la posizione nella mano (0-2).
    // tempo è la durata dell'animazione in ms
    daiCarta(giocatore, indice, tempo=1000) {
        if (this.mazzo.vuoto()) return
        var carta = this.mazzo.pesca()
        this.mani[giocatore][indice] = carta
        if (DEBUG) console.log(`giocatore ${giocatore} riceve ${carta} in posizione ${indice}`)
        if (DEBUG) console.log(this.mani[giocatore])
        var img = this.gfx_mazzo.pop() // img graficamente in cima al mazzo, ma in fondo all'array
        var gfx = (giocatore==0)? this.gfx_manopc : this.gfx_manome
        // se è la briscola (ultima), mostra il dorso e ripristina l'orientamento
        if (img.style.transform != '') {
            img.src = 'trieste/Dorso.webp'
            img.style.transform = ''
        }
        this.animaImmagine(img, {x: gfx[indice].x, y: gfx[indice].y}, tempo)
        if (giocatore) {
            img.src = `trieste/${carta}.webp`
            img.setAttribute('onclick', `partita.gioca(1,${indice})`) // assegna un evento onclick
        }
        img.style.zIndex = indice // la carta successiva è sovrapposta alla precedente
        // la carta voltata è un oggetto diverso da quella, invisibile, già in gfx_manoXX
        // perciò la registriamo, per poterla successivamente muovere verso il banco
        gfx[indice+10] = img 
        // aggiorna il conteggio delle carte nel mazzo e i punti
        this.disegnaRestanti()
    }

    // fa la distribuzione iniziale delle carte
    daiCarte() {
        var tempo = 500 // la durata dell'animazione è leggermente diversa per ogni carta, così da distinguerle
        for (var i=0; i<3; i++) {
            this.daiCarta(0, i, tempo) // al PC
            tempo += 500
            this.daiCarta(1, i, tempo) // a me
            tempo += 600
        }
    }

    animaImmagine(img, puntoB, durata, passo=0.01) {
        var progresso=0
        this.animazione = 1
        const animazione = setInterval(() => {
            // nuova posizione
            const x = img.x + (puntoB.x - img.x) * progresso
            const y = img.y + (puntoB.y - img.y) * progresso

            // aggiorna l'immagine
            img.style.left = x + 'px'
            img.style.top = y + 'px'

            // finito?
            if (progresso >= 1) {
                clearInterval(animazione)
                this.animazione = 0
            }
            progresso += passo
        }, durata / 100)
    }

    // gioca la carta indice=0..2 del giocatore=0..1
    gioca(giocatore, indice) {
        // impedisce il gioco umano finché ci sono animazioni in corso
        if (giocatore && this.animazione) return
        var pausa = 0
        // anima la carta giocata da mano a banco
        var gfx = (giocatore==0)? this.gfx_manopc : this.gfx_manome
        gfx[indice+10].onclick = undefined // elimina il gestore di onclick per sicurezza
        // se gioca il PC, rende visibile la sua carta
        if (giocatore == 0) gfx[indice+10].src = `trieste/${this.mani[0][indice]}.webp`
        this.animaImmagine(gfx[indice+10], {x: this.gfx_banco[giocatore].x, y: this.gfx_banco[giocatore].y}, 1500)
        this.gfx_banco[giocatore+10] = gfx[indice+10] // registra la carta visibile giocata sul banco
        // aggiorna mano e banco
        this.giocate[giocatore] = this.mani[giocatore][indice]
        // la posizione nella mano rimane undefined fino all'eventuale pescata successiva
        this.mani[giocatore][indice] = undefined
        // l'ultima giocata viene sovrapposta all'altra
        if (this.giocate.length == 2) gfx[indice+10].style.zIndex = 99
        if (DEBUG) console.log(`giocatore ${giocatore} gioca carta ${this.giocate[giocatore]} da posizione ${indice}`)
        // inserisce la mossa nella cronologia
        this.cronologia.push({giocatore: giocatore, indice: indice, carta: this.giocate[giocatore]})
        // se ha giocato per primo l'umano, fa giocare il PC
        if (this.di_turno == 1) {
            pausa=1600
            this.di_turno = 0
            // evita che la risposta del PC sia contemporanea all'animazione della giocata umana
            setTimeout(this.giocatore_pc.gioca.bind(this.giocatore_pc), pausa, this)
            //~ this.giocatore_pc.gioca(this)
        }
        // se ambedue hanno giocato, determina chi prende
        if (this.giocate.length == 2)
            setTimeout(this.arbitra.bind(this), pausa+1500, 0)
    }

    // determina chi ha vinto la mano, sposta le carte, pesca e prepara la prossima  mano
    arbitra() {
        if (this.giocate.length != 2) return
        console.log('giocate', this.giocate)
        // determina chi prende
        var r = this.mazzo.prende(this.giocate[0], this.giocate[1], this.primo_di_mano)
        // calcola i punti presi
        var punti = this.mazzo.punti(this.giocate[0]) + this.mazzo.punti(this.giocate[1])
        // identifica le carte sul banco
        let c1 = this.gfx_banco[10], c2 = this.gfx_banco[11]
        // sovrappone le carte prese ad altri oggetti
        c1.style.zOrder = 101
        c2.style.zOrder = 101
        var indici = []
        indici[this.cronologia.slice(-1)[0].giocatore] = this.cronologia.slice(-1)[0].indice
        indici[this.cronologia.slice(-2,-1)[0].giocatore] = this.cronologia.slice(-2,-1)[0].indice
    
        if (r < 0) {
            if (DEBUG) console.log(`UMANO prende ${punti} punti`)
            this.punti_me += punti
            this.di_turno = this.primo_di_mano = 1
            // anima la presa
            this.animaImmagine(c1, {x: c1.x, y: c1.y + 1.75*c1.height}, 500)
            this.animaImmagine(c2, {x: c2.x, y: c2.y + 1.75*c2.height}, 500)
            // nasconde le carte prese
            setTimeout((a,b) => {a.style.visibility = b.style.visibility = 'hidden'}, 500, c1, c2)
            // pesca (l'animazione del 2° è leggermente più lenta, per distinguere visivamente i turni di pescata)
            setTimeout(this.daiCarta.bind(this), 500, 1, indici[1])
            setTimeout(this.daiCarta.bind(this), 900, 0, indici[0], 600)
        } else
        if (r > 0) {
            if (DEBUG) console.log(`PC prende ${punti} punti`)
            this.punti_pc += punti
            this.di_turno = this.primo_di_mano = 0
            this.animaImmagine(c1, {x: c1.x, y: c1.y - 1.75*c1.height}, 500)
            this.animaImmagine(c2, {x: c2.x, y: c2.y - 1.75*c2.height}, 500)
            setTimeout((a,b) => {a.style.visibility = b.style.visibility = 'hidden'}, 500, c1, c2)
            setTimeout(this.daiCarta.bind(this), 500, 0, indici[0])
            setTimeout(this.daiCarta.bind(this), 900, 1, indici[1])
            setTimeout(this.giocatore_pc.gioca.bind(this.giocatore_pc), 2000, this)
        }
    
        this.disegnaRestanti()
        this.giocate = []
        
        if (this.cronologia.length == 40) setTimeout(this.vittoria.bind(this), 1700)
        
    }
    
    vittoria() {
            if (this.punti_me == this.punti_pc) window.alert('Pareggio!')
            if (this.punti_me > this.punti_pc) window.alert(`${this.punti_me} a ${this.punti_pc}: hai vinto tu!`)
            if (this.punti_me < this.punti_pc) window.alert(`${this.punti_pc} a ${this.punti_me}: ho vinto io!`)
            this.avvia()
    }
};
