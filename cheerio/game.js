//~ Copyright (C)2011-2019, by maxpat78
//~ Licensed according to Creative Commons CC0 1.0 Universal
//~ This free software lets you play Cheerio dice game in a browser

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
// Here starts the true Cheerio game implementation
//


// Enumerazione delle combinazioni valide
const Punti = {
    Uno:0, Due:1, Tre:2, Quattro:3, Cinque:4, Sei:5, Cheerio:6
}

// n è il numero di dadi da trovare
function trovaMultipli(dadi, n, conJolly) {
    multipli = [0,0,0]
    j = 0
    wild=conJolly? dadi[0]:0
    for (i = dadi.length - 1; i >= 0; i--)
        if (dadi[i]+wild >= n && i) // somma i jolly se il dado non è "1"
            multipli[j++] = i+1 // multiplo più alto
    return multipli
}

// Determina se esistano 3,4,5 dadi uguali, anche con jolly
// e torna il relativo punteggio
function puntiMultipli(dadi, n, conJolly) {
    if (trovaMultipli(dadi, n)[0]) return n*10
    if (trovaMultipli(dadi, n, true)[0]) return n*5
    return 0
}

// La scala di 5 dadi può essere 1-5 o 2-6
// BUG! Jolly!
function trovaScala(dadi)
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

function calcolaPuntiDado(d, dadi) {
    var punti = dadi[d-1]? d*dadi[d-1]:0
    if (!punti) return 0
    if (dadi[d-1]==5) punti*=2
    if (d==1) return punti
    punti += d*dadi[0]
    return punti
}


// La seguente riceve un semplice array dei dadi usciti
// e uno di risultati da riempire
function calcolaPuntiMano(dadi, puntiMano) {
  var dadiPerValore = new Array(6).fill(0)

  for (i = 0; i < dadi.length; i++)
      dadiPerValore[dadi[i] - 1]++

  // Assi
  puntiMano[Punti.Uno] = calcolaPuntiDado(1, dadiPerValore)
  // Due
  puntiMano[Punti.Due] = calcolaPuntiDado(2, dadiPerValore)
  // Tre
  puntiMano[Punti.Tre] = calcolaPuntiDado(3, dadiPerValore)
  // Quattro
  puntiMano[Punti.Quattro] = calcolaPuntiDado(4, dadiPerValore)
  // Cinque
  puntiMano[Punti.Cinque] = calcolaPuntiDado(5, dadiPerValore)
  // Sei
  puntiMano[Punti.Sei] = calcolaPuntiDado(6, dadiPerValore)
  // Cheerio
  scala = trovaScala(dadiPerValore)
  puntiMano[Punti.Cheerio] = (scala==5 || scala==6) ? 50 : 0
}


D6.creaDadi = function(callback, callbackData) {
	buttonLabel = "Lancia!"
	D6.numDice = 5
	D6.numDiceShown = 5
	results = []
	for (i=0; i<5; ++i) {
		results[i] = 0
	}
	builder = new D6AnimBuilder("dice", results, null, D6.baseUrl, 5, 50, true)
	D6.builder = builder
	D6AnimBuilder.onClick = function(id) {D6.diceSave(id)}
	layout = [1]
	if (!callback) callback= D6Sample.noop
	if (!callbackData) callbackData = null
	middleManData = {
		"id" : "dice",
		"callback" : callback,
		"callbackData" : callbackData
	}
	genHtml = "<div id='diceall' style='position:relative; top: -170px; left: 270px;'>" + builder.genDiceHtml(layout, D6.middleManCallback, middleManData) + builder.genSDiceHtml(layout)
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
    for (i=1; i<D6.numDice+1; i++)
        document.getElementById('sdice'+i).src="blank.gif"
    // Resetta le caselle non annotate
    for (p in Punti) {
        e = document.getElementById(p)
        if (puntiSalvati[Punti[p]] == undefined)
            e.innerHTML = ""
        else {
            e.style.color = "initial"
            e.style.fontWeight = "initial"
        }
    }
    // Somma i punti della sezione superiore
    somma=0
    for (i=0; i < puntiSalvati.length; i++)
        somma += (puntiSalvati[i]==undefined? 0:puntiSalvati[i])

    // Calcola il punteggio finale, sommando la sezione inferiore
    if (turniRimasti == 0) {
        document.getElementById("Totale").innerHTML = somma
        storeScore(somma)
    }
    puntoDaAnnotare = false
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
}

var puntiSalvati, puntiMano, dadiSalvati, tiriRimasti, turniRimasti, puntoDaAnnotare

function resetGioco() {
    D6.diceToShow(5)
    puntiSalvati = new Array(7)
    dadiSalvati = new Array(D6.numDice)
    tiriRimasti = 3
    turniRimasti = 7
    puntoDaAnnotare = false
    for (p in Punti) {
        e = document.getElementById(p)
        e.innerHTML = ""
    }
}


function hallOfFame() {
    document.write('<html><body>')
    document.write('<div style="text-align:center"><a href="index.html">(Torna al gioco)</a></div>')
    document.write('<h2>Ultimi 100 punteggi</h2>')
    document.write('<table>')
    punteggi = getScore()
    for (k in punteggi) {
        document.write('<tr><td>'+k+'</td><td style=""></td><td>'+punteggi[k]+'</td></tr>')
    }
    document.write('</table>')
    document.write('</body></html>')
}


function getScore() {
    cookie = document.cookie.split(';')
    myCookie="", label='punteggi='
    punteggi = {}

    for(i=0; i<cookie.length; i++)
    {
        t = cookie[i].trim()
        if (t.indexOf(label)==0)
            myCookie = t.substring(label.length, t.length)
    }

    if (myCookie)
        punteggi = JSON.parse(myCookie)

    return punteggi
}


// Salva cronologicamente gli ultimi 100 punteggi
function storeScore(score) {
    punteggi = getScore()
    if (Object.keys(punteggi).length == 100) {
        delete punteggi[Object.keys(punteggi)[0]]
    }
    if (! punteggi)
        punteggi = {}
    punteggi[new Date().toLocaleString()] = score
    setCookie('punteggi', JSON.stringify(punteggi), 365)
}


function setCookie(cname, cvalue, exdays) {
  d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
