//~ Copyright (C)2011-2019, by maxpat78
//~ Licensed according to Creative Commons CC0 1.0 Universal
//~ This free software lets you play Yahtzee dice game in a browser

//
// My patches to D6.js
//
D6AnimBuilder.prototype.genDiceHtml = function(layout, callback, callbackData) {
	this.layout = layout;
	this.callback = callback;
	this.callbackData = callbackData;
	var dieCount = 0;
	var genHtml = "";
	var numTotalImgs = this.groupsize * this.numGroups;
	for (var i=0; i<layout.length; ++i) {
		if (dieCount >= numTotalImgs) break;
		genHtml += "<div id='" + this.id + "_diceGroup_" + i + "' class='diceGroup'>";
		var imgsThisRow = layout[i] * this.groupsize;
		for (var j=0; j<imgsThisRow; ++j) {
			++dieCount;
			if (dieCount > numTotalImgs) break;
			if (this.useImages) {
				genHtml += "<img id='" + this.id + dieCount + "' class='die' src='" + this.baseUrl + "blank.gif' onclick='D6AnimBuilder.onClick(" + dieCount + ")' />";
			} else {
				genHtml += "<span id='" + this.id + dieCount + "' class='dieNumber'>&nbsp;</span> ";
			}
		}
		genHtml += " <span id='sidebar_" + i + "' class='sidebar'></span>";
		genHtml += "</div>\n";
	}
	return genHtml;
}

D6AnimBuilder.prototype.genSDiceHtml = function(layout) {
	this.layout = layout;
	var dieCount = 0;
	var genHtml = "";
	var numTotalImgs = this.groupsize * this.numGroups;
	for (var i=0; i<layout.length; ++i) {
		if (dieCount >= numTotalImgs) break;
		genHtml += "<div id='" + this.id + "_sdiceGroup_" + i + "' class='diceGroup'>";
		var imgsThisRow = layout[i] * this.groupsize;
		for (var j=0; j<imgsThisRow; ++j) {
			++dieCount;
			if (dieCount > numTotalImgs) break;
			if (this.useImages) {
				genHtml += "<img id='s" + this.id + dieCount + "' class='die' src='" + this.baseUrl + "blank.gif' onclick='D6AnimBuilder.onClick(" + dieCount + ")' />";
			} else {
				genHtml += "<span id='s" + this.id + dieCount + "' class='dieNumber'>&nbsp;</span> ";
			}
		}
		genHtml += " <span id='ssidebar_" + i + "' class='sidebar'></span>";
		genHtml += "</div>\n";
	}
	return genHtml;
}

D6.diceToShow = function(numDice) {
	if (!numDice) numDice = 0;
	if (numDice < 0) numDice = 0;
	if (numDice > D6.numDice) numDice = D6.numDice
	if (numDice == D6.numDiceShown) return
	var i
	var dieElem
	for (i=1; i<=numDice; ++i) {
		dieElem = document.getElementById('dice' + i)
		if (dieElem) dieElem.style.visibility = ""
	}
	for ( ; i<=D6.numDice; ++i) {
		dieElem = document.getElementById('dice' + i)
		if (dieElem) dieElem.style.visibility = "hidden"
	}
	D6.numDiceShown = numDice
}

// Shows or Hides a specific die, keeping the last visible
D6.diceSave = function(numDie) {
	if (!numDie || numDie < 0 || numDie > D6.numDie || D6.inizioTurno) return
	dieElem = document.getElementById('dice' + numDie)
	sdieElem = document.getElementById('sdice' + numDie)
	if (dieElem.style.visibility == "hidden") {
		sdieElem.style.visibility = "hidden"
		dieElem.src = sdieElem.src
		dieElem.style.visibility = ""
		D6.numDiceShown+=1
	} else {
		dieElem.style.visibility = "hidden"
		sdieElem.style.visibility = ""
		sdieElem.src = dieElem.src
		D6.numDiceShown-=1
	}
}

// Updates the results array with not saved dice only
D6.diceGet = function(dadi) {
	for(i=1; i<D6.numDice+1; i++)
		if (document.getElementById('dice' + i).style.visibility == "")
			dadi[i-1] = D6.builder.results[i-1]
}



//
// Here starts the true Yahtzee game implementation
//

// Enumerazione delle combinazioni valide
const Punti = {
    Uno:0, Due:1, Tre:2, Quattro:3, Cinque:4, Sei:5,
    Tris:6, Poker:7, Full:8, Scala4:9, Scala5:10,
    Chance:11, Yahtzee:12
}

// Le seguenti funzioni elaborano un array di 6 elementi, in cui ogni indice
// rappresenta un dado e il valore la sua frequenza 
function sommaDadi(dadi) {
    var somma = 0
    for (i = 0; i < 6; i++)
        somma += dadi[i] * (i + 1)
    return somma
}

// n è il numero di dadi da trovare
function trovaMultipli(dadi, n) {
    var multipli = new Array(3).fill(0)
    var j = 0
    for (i = dadi.length - 1; i >= 0; i--)
        if (dadi[i] >= n)
            multipli[j++] = i+1 // multiplo più alto

    return multipli
}

// La scala di 5 dadi può essere 1-5 o 2-6
function trovaScala5(dadi)
{
    for (i = 1; i < dadi.length-1; i++)
        if (dadi[i] == 0) // no seq. comune 2-3-4-5
            return 0
    if (dadi[0] == 1)
        return 5 // scala al 5
    if (dadi[5] == 1)
        return 6 // scala al 6
    return 0
}

// La scala di 4 dadi può essere 1-4, 2-5 o 3-6
function trovaScala4(dadi)
{
    if (!dadi[2] || !dadi[3]) // 3 e 4 comuni a tutte le ipotesi
        return 0
    if (dadi[0]&&dadi[1] || dadi[1]&&dadi[4] || dadi[4]&&dadi[5])
        return 1
    return 0
}

// La seguente riceve un semplice array dei dadi usciti
// e uno di risultati da riempire
function calcolaPuntiMano(dadi, puntiMano) {
    var dadiPerValore = new Array(6).fill(0)

    for (i = 0; i < dadi.length; i++)
        dadiPerValore[dadi[i] - 1]++

    var isYahtzee = trovaMultipli(dadiPerValore, 5)[0]

    // Annotati Yahtzee e corrispondente cinquina?
    var isYahtzeeJolly = isYahtzee && puntiSalvati[Punti.Yahtzee] != undefined && puntiSalvati[isYahtzee-1] != undefined

    if (isYahtzee && puntiSalvati[Punti.Yahtzee] == 50) // Yahtzee *valido* già annotato
        yahtzeeBonus++

    // Uno
    puntiMano[Punti.Uno] = dadiPerValore[0];
    // Due
    puntiMano[Punti.Due] = dadiPerValore[1] * 2
    // Tre
    puntiMano[Punti.Tre] = dadiPerValore[2] * 3
    // Quattro
    puntiMano[Punti.Quattro] = dadiPerValore[3] * 4
    // Cinque
    puntiMano[Punti.Cinque] = dadiPerValore[4] * 5
    // Sei
    puntiMano[Punti.Sei] = dadiPerValore[5] * 6
    // Tris
    puntiMano[Punti.Tris] = trovaMultipli(dadiPerValore, 3)[0]? sommaDadi(dadiPerValore) : 0
    // Poker
    puntiMano[Punti.Poker] = trovaMultipli(dadiPerValore, 4)[0]? sommaDadi(dadiPerValore) : 0
    // Full (3x + 2y OPPURE 3x + 2x)
    var Tris = trovaMultipli(dadiPerValore, 3)[0]
    var Coppia = trovaMultipli(dadiPerValore, 2)[1]
    puntiMano[Punti.Full] = ((Tris&&Coppia) || isYahtzee || isYahtzeeJolly)? 25 : 0
    // Scala di 4
    puntiMano[Punti.Scala4] = (trovaScala4(dadiPerValore) || isYahtzeeJolly)? 30 : 0
    // Scala di 5
    puntiMano[Punti.Scala5] = (trovaScala5(dadiPerValore) || isYahtzeeJolly)? 40 : 0
    // Chance
    puntiMano[Punti.Chance] = sommaDadi(dadiPerValore)
    // Yahtzee
    puntiMano[Punti.Yahtzee] = isYahtzee? 50 : 0
}


D6.creaDadi = function(callback, callbackData) {
	buttonLabel = "Lancia!"
	D6.numDice = 5
	D6.numDiceShown = 5
	var results = new Array()
	var i
	for (i=0; i<5; ++i) {
		results[i] = 0
	}
	var builder = new D6AnimBuilder("dice", results, null, D6.baseUrl, 5, 50, true)
	D6.builder = builder
	D6AnimBuilder.onClick = function(id) {D6.diceSave(id)}
	var layout = [1]
	if (!callback) callback= D6Sample.noop
	if (!callbackData) callbackData = null
	var middleManData = {
		"id" : "dice",
		"callback" : callback,
		"callbackData" : callbackData
	}
	var genHtml = "<div id='diceall' style='position:relative; top: -425px; left: 270px;'>" + builder.genDiceHtml(layout, D6.middleManCallback, middleManData) + builder.genSDiceHtml(layout)
	if (buttonLabel != "none") {
		genHtml += "<div id='diceform'><form><input style='width:60px' type='button' id='dicebutton' value='" + buttonLabel +
    "' onclick='tiraDadi()'/> <button style='width:60px' onclick='resetGioco()' align='right'>Azzera</button></form></div>"
	}
	genHtml += "</div>"
	D6.genHtml = genHtml
	document.write(genHtml)
}


function tiraDadi() {
    if (tiriRimasti == 0 || turniRimasti == 0) return
    dice = D6AnimBuilder.get("dice")
    dice.reset()
    dice.start()
    tiriRimasti--
    D6.inizioTurno = false
    infoDiv()
}


// Annota il punteggio scelto e prepara una nuova mano
function annota(id) {
    // Verifica che la combinazione non sia già assegnata
    if (puntiSalvati[id] != undefined) return
    // Verifica che sia appena stato eseguito un tiro
    if (! puntoDaAnnotare) return
    puntiSalvati[id] = puntiMano[id]
    tiriRimasti = 3
    turniRimasti--
    dadiSalvati = new Array(D6.numDice)
    D6.diceToShow(5)
    D6.inizioTurno = true
    for (i=1; i<D6.numDice+1; i++)
        document.getElementById('sdice'+i).src="blank.gif"
    // Resetta le caselle non annotate
    for (var p in Punti) {
        e = document.getElementById(p)
        if (puntiSalvati[Punti[p]] == undefined)
            e.innerHTML = ""
        else {
            e.style.color = "initial"
            e.style.fontWeight = "initial"
        }
    }
    // Somma i punti della sezione superiore
    var somma=0;
    for (i=0; i < 6; i++)
        somma += (puntiSalvati[i]==undefined? 0:puntiSalvati[i])
    document.getElementById("Subtotale").innerHTML = somma

    // Assegna il bonus per la sezione superiore
    if (somma > 62) {
        somma += 35
        document.getElementById("Bonus").innerHTML = 35
    }

    // Assegna il bonus per eventuali Yahtzee ulteriori al primo
    if (yahtzeeBonus) {
        somma += yahtzeeBonus*100
        document.getElementById("YBonus").innerHTML = yahtzeeBonus*100
    }

    // Calcola il punteggio finale, sommando la sezione inferiore
    if (turniRimasti == 0) {
        for (i=6; i<13; i++)
            somma += puntiSalvati[i]
        document.getElementById("Totale").innerHTML = somma
        storeScore(somma)
    }

    puntoDaAnnotare = false
    infoDiv()
}


// Modifica una casella di punteggio al passaggio del mouse
function onMouse(id, action) {
    for (p in Punti)
        if (Punti[p] == id) {
            e = document.getElementById(p)
            break
        }
    if (action == 1)
        e.style.backgroundColor = "yellow"
    else
        e.style.backgroundColor = "initial"
}


// Aggiorna le informazioni dopo il tiro
var callback = function (total, info, results) {
    D6.diceGet(dadiSalvati)
    puntiMano = new Array(13).fill(0)
    calcolaPuntiMano(dadiSalvati, puntiMano)
    for (var p in Punti) {
        if (puntiSalvati[Punti[p]] == undefined) {
            e = document.getElementById(p)
            e.innerHTML = puntiMano[Punti[p]]
            e.style.color = "green"
            e.style.fontWeight = "bold"
        }
    }
    puntoDaAnnotare = true
    infoDiv()
}

var puntiSalvati, puntiMano, dadiSalvati, tiriRimasti, turniRimasti, puntoDaAnnotare
var yahtzeeBonus

function resetGioco() {
    D6.diceToShow(5)
    D6.inizioTurno = true
    puntiSalvati = new Array(13)
    dadiSalvati = new Array(D6.numDice)
    tiriRimasti = 3
    turniRimasti = 13
    puntoDaAnnotare = false
    yahtzeeBonus = 0
    infoDiv()
    for (var p in Punti) {
        e = document.getElementById(p)
        e.innerHTML = ""
    }
}

function infoDiv() {
    if (!turniRimasti) {
        document.getElementById("infodiv").innerHTML = "Partita conclusa. Premi Azzera se vuoi giocare di nuovo."
        return
    }
    s = "Hai "+tiriRimasti+" tiri e "+turniRimasti+" turni. "
    if (D6.inizioTurno) s += "Inizia il turno "+(16-turniRimasti)+". "
    if (puntoDaAnnotare) s += "Puoi segnare i tuoi punti."
    document.getElementById("infodiv").innerHTML = s
}


function hallOfFame() {
    document.write('<html><body>')
    // javascript:history.back() non vale, poiché siamo tecnicamente nella stessa pagina... riscritta!
    document.write('<div style="text-align:center"><a href="index.html">(Torna al gioco)</a></div>')
    document.write('<h2>Ultimi 100 punteggi</h2>')
    document.write('<table>')
    var punteggi = getScore()
    for (var k in punteggi) {
        document.write('<tr><td>'+k+'</td><td style=""></td><td>'+punteggi[k]+'</td></tr>')
    }
    document.write('</table>')
    document.write('</body></html>')
}

// Recupera i punteggi annotati nel cookie
function getScore() {
    var cookie = document.cookie.split(';')
    var myCookie="", label='punteggi='
    var punteggi = {}

    for(i=0; i<cookie.length; i++)
    {
        var t = cookie[i].trim()
        if (t.indexOf(label)==0)
            myCookie = t.substring(label.length, t.length)
    }

    if (myCookie)
        punteggi = JSON.parse(myCookie)

    return punteggi
}

// Salva cronologicamente gli ultimi 100 punteggi
function storeScore(score) {
    var punteggi = getScore()
    if (Object.keys(punteggi).length == 100) {
        delete punteggi[Object.keys(punteggi)[0]]
    }
    if (! punteggi)
        punteggi = {}
    punteggi[new Date().toLocaleString()] = score
    setCookie('punteggi', JSON.stringify(punteggi), 365)
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
