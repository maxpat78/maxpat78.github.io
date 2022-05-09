//~ Copyright (C)2011-2019, by maxpat78
//~ Licensed according to Creative Commons CC0 1.0 Universal
//~ This free software lets you play Zilch dice game in a browser


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

// Un dado è bloccato a inizio turno o se salvato dopo un precedente tiro
D6.diceIsLocked = function(numDie) {
    if (D6.inizioTurno || dadiSalvati[numDie-1] != undefined) return 1
    return 0
}

// Accantona o ripristina un certo dado
D6.diceSave = function(numDie) {
	if (!numDie || numDie < 0 || numDie > D6.numDie || D6.diceIsLocked(numDie)) return
	dieElem = document.getElementById('dice' + numDie)
	sdieElem = document.getElementById('sdice' + numDie)
	if (dieElem.style.visibility == "hidden") {
		sdieElem.style.visibility = "hidden"
		dieElem.src = sdieElem.src
		dieElem.style.visibility = ""
		D6.numDiceShown+=1
		i = D6.diceSelected.indexOf(D6.builder.results[numDie-1])
		if (i>-1)
			D6.diceSelected.splice(i,1)
	} else {
		dieElem.style.visibility = "hidden"
		sdieElem.src = dieElem.src
		sdieElem.style.visibility = ""
		D6.numDiceShown-=1
		D6.diceSelected.push(D6.builder.results[numDie-1])
	}
	// Aggiorna i punti da salvare secondo la selezione
    puntiTiro = calcolaPuntiDadi(D6.diceSelected)[0]
}

// Ritorna un array di dadi selezionati
D6.diceGetSelected = function(dadi) {
	var dadi=[]
	for(i=1; i<D6.numDice+1; i++)
		if (document.getElementById('dice' + i).style.visibility == "hidden" && dadiSalvati[i-1] == undefined)
			dadi.push(D6.builder.results[i-1])
	return dadi
}

// Ritorna un array di dadi tirati
D6.diceGet = function() {
	var dadi=[]
	for(i=1; i<D6.numDice+1; i++)
		if (document.getElementById('dice' + i).style.visibility == "")
			dadi.push(D6.builder.results[i-1])
	return dadi
}



//
// Here starts the true Zilch game implementation
//

String.prototype.format = function() {
  a = this
  for (k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}

// n è il numero di dadi da trovare
function trovaMultipli(dadi, n) {
    var multipli = [0,0,0]
    var j = 0
    for (i = dadi.length - 1; i >= 0; i--)
        if (dadi[i] >= n)
            multipli[j++] = i+1 // multiplo più alto
    return multipli
}

function puntiUnoCinque(faccia, dadi)
{
    if (faccia == 1)
        return [dadi[4]*50, dadi[4]]
    if (faccia == 5)
        return [dadi[0]*100, dadi[0]]
    return [dadi[0]*100+dadi[4]*50, dadi[0]+dadi[4]]
}

// Ritorna il punteggio calcolato su un array di dadi
// e il numero di dadi usati per formarlo
function calcolaPuntiDadi(dadi) {
    dadiPerValore = [0,0,0,0,0,0]
    for (i=0; i<dadi.length; i++)
        dadiPerValore[dadi[i]-1]++
	// Scala 1-6
	if (Config.scala6)
		if (dadiPerValore.indexOf(0)<0)
			return [3000, 6]
	if (Config.combo456) {
		// Sestina
		faccia = trovaMultipli(dadiPerValore, 6)[0]
		if (faccia)
			return [faccia==1? 8000:800 * faccia, 6]
		// Cinquina
		faccia = trovaMultipli(dadiPerValore, 5)[0]
		if (faccia) {
			m = faccia==1? 4000:400
			pt = puntiUnoCinque(faccia, dadiPerValore)
			return [faccia*m+pt[0], 5+pt[1]]
		}
		// Quaterna
		faccia = trovaMultipli(dadiPerValore, 4)[0]
		if (faccia) {
			coppia = trovaMultipli(dadiPerValore, 2)[1]
			pt = puntiUnoCinque(faccia, dadiPerValore)
			if (!coppia) {
				m = faccia==1? 2000:200
				return [faccia*m+pt[0], 4+pt[1]]
			}
			if (faccia != 1)
				return [1500, 6] // 3 coppie > quaterna (2-6)
			else
				return [2000+pt[0], 4+pt[1]] // quaterna di 1
		}
	}
	// Tris
	Tris = trovaMultipli(dadiPerValore, 3)
	if (Tris[1]>0) { // 2 Tris
		if (Tris[0] == 1)
			return [1000+Tris[1]*100, 6]
		if (Tris[1] == 1)
			return [1000+Tris[0]*100, 6]
		return [Tris[0]*100+Tris[1]*100, 6]
	}
	if (Tris[0]>0) { // 1 Tris
		m = Tris[0]==1? 1000:100
		pt = puntiUnoCinque(Tris[0], dadiPerValore)
		return [Tris[0]*m+pt[0], 3+pt[1]]
	}
	if (Config.combo3x2)
		// Tripla coppia
		if (trovaMultipli(dadiPerValore, 2)[2] > 0)
			return [1500, 6]
	// 1 e 5 vanno computati per ultimi, se non inseriti in altre combinazioni
	// di maggior valore
	return puntiUnoCinque(0, dadiPerValore)
}

function nominaPuntiDadi(dadi) {
    dadiPerValore = [0,0,0,0,0,0]
    for (i=0; i<dadi.length; i++)
        dadiPerValore[dadi[i]-1]++
	if (Config.scala6)
		if (dadiPerValore.indexOf(0)<0)
			return "Scala di 6"
	if (Config.combo456) {
		faccia = trovaMultipli(dadiPerValore, 6)[0]
		if (faccia) return "Sestina di "+faccia
		faccia = trovaMultipli(dadiPerValore, 5)[0]
		if (faccia) 	return "Cinquina di "+faccia
		faccia = trovaMultipli(dadiPerValore, 4)[0]
		if (faccia) {
			coppia = trovaMultipli(dadiPerValore, 2)[1]
			pt = puntiUnoCinque(faccia, dadiPerValore)
			if (!coppia) {
				s = "Quaterna di "+faccia
				if (pt[0]) s += " con 1 o 5"
				return s
			}
			if (faccia != 1)
				return "Tripla coppia"
			else
				return "Quaterna di 1"
		}
	}
	Tris = trovaMultipli(dadiPerValore, 3)
	if (Tris[1]>0)
		return "Doppio tris"
	if (Tris[0]>0) {
		s = "Tris di "+Tris[0]
		pt = puntiUnoCinque(Tris[0], dadiPerValore)
		if (pt[0]) s+=" con 1 o 5"
		return s
	}
	if (Config.combo3x2)
		if (trovaMultipli(dadiPerValore, 2)[2] > 0)
			return "Tripla coppia"
	if (puntiUnoCinque(0, dadiPerValore)[0])
		return "1 o 5"
	return "Zilch"
}

D6.creaDadi = function(callback, callbackData) {
	buttonLabel = "Tira!"
	D6.numDice = 6
	D6.numDiceShown = 6
	results = []
	for (i=0; i<D6.numDice; ++i) {
		results[i] = 0
	}
	builder = new D6AnimBuilder("dice", results, null, D6.baseUrl, D6.numDice, 50, true)
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
	genHtml = "<div id='diceall' align='center'>" + builder.genDiceHtml(layout, D6.middleManCallback, middleManData) + builder.genSDiceHtml(layout)
	if (buttonLabel != "none") {
		genHtml += "<div id='diceform'><form><input style='width:80px;height:40px' type='button' id='dicebutton' value='" + buttonLabel +
    "' onclick='tiraDadi()'/><br><input style='width:80px;height:40px' type='button' onclick='salvaPunti()' value='Salva'/><br><input style='width:80px;height:40px' type='button' onclick='resetGioco()' value='Azzera'/></form></div>"
	}
	genHtml += "</div>"
	D6.genHtml = genHtml
	document.write(genHtml)
}


function tiraDadi() {
	// Resetta dopo uno Zilch
	if (wasZilch) {
		// Permette eventualmente il secondo tiro del sesto dado
		if (Config.doppio15 && doppio15++ < 1 && D6.numDiceShown==1) {
			wasZilch = false
			dice = D6AnimBuilder.get("dice")
			dice.reset()
			dice.start()
			D6.inizioTurno = false
			tiriTotali++
			return
		}
		resetTurno()
		D6.diceSaved.length = D6.diceSavedLast
	}
	if (!D6.inizioTurno) {
		// Blocca il tiro: se abbiamo superato i 10000 punti...
		if (puntiSalvati>10000) return
		// ...se non si accantona almeno un dado...
		if (!D6.diceSelected.length) return
		// ...se si accantonano dadi senza valore
		if (D6.diceSelected.length != calcolaPuntiDadi(D6.diceSelected)[1]) {
			document.getElementById("infodiv1").innerHTML = "Seleziona solo i dadi <i>*utili*</i> prima di tirare!"
			return
		}
		// Registra i dadi accantonati
		D6.diceSaved.push(D6.diceSelected)
		D6.diceSelected = []
		// aggiorna i punti accumulati con i vari tiri
		puntiMano += puntiTiro
	}
	// Se sono stati accumulati tutti i dadi, li riutilizziamo
	if (!D6.numDiceShown) {
	    D6.diceToShow(6)
		for (i=1; i<D6.numDice+1; i++)
			document.getElementById('sdice'+i).src="blank.gif"
	}
    dice = D6AnimBuilder.get("dice")
    dice.reset()
    dice.start()
    D6.inizioTurno = false
	tiriTotali++
	infoDiv()
}

function salvaPunti() {
	if (!puntoDaAnnotare || !D6.diceSelected || wasZilch) return
	// Salva i punti accumulati nella mano
	puntiAccumulati = puntiMano+calcolaPuntiDadi(D6.diceSelected)[0]
	puntiSalvati += puntiAccumulati
	D6.diceSavedLast = D6.diceSaved.length
	sequenzaZilch=0 // resetta la tripletta di Zilch penalizzanti
	resetTurno()
	document.getElementById("infodiv1").innerHTML = "Hai messo in salvo {0} punti, ne hai {1} in tutto!".format(puntiAccumulati, puntiSalvati)
	if (puntiSalvati < 10000)
		document.getElementById("infodiv2").innerHTML = "Lancia i dadi!"
	else {
		document.getElementById("infodiv2").innerHTML = "<b>HAI VINTO!</b>"
		storeScore(puntiSalvati)
	}
}

// Aggiorna le informazioni dopo il tiro
var callback = function (total, info, results) {
	sogliaPunti = Config.soglia300? 300:50
    dadi = D6.diceGet()
	punti = calcolaPuntiDadi(dadi)
	puntiTiro = punti[0]
	document.getElementById("infodiv3").innerHTML = "Hai fatto "+nominaPuntiDadi(dadi)
    if (! puntiTiro) {
		wasZilch = true
		totZilch++
		sequenzaZilch++
        document.getElementById("infodiv2").innerHTML = "<b>Z I L C H !</b>"
		if (D6.inizioTurno && Config.zilch1) {
			document.getElementById("infodiv1").innerHTML = "Zilch di turno, guadagni 500 punti!"
			puntiSalvati+=500
		}
		if (sequenzaZilch==3 && Config.zilch3) {
			document.getElementById("infodiv1").innerHTML = "Terzo Zilch consecutivo, perdi 500 punti!"
			puntiSalvati-=500
			seqZilch=0
		}
		if (Config.doppio15 && !doppio15 && D6.numDiceShown==1)
			document.getElementById("infodiv3").innerHTML = "Hai fatto Zilch, ma puoi tirare il sesto dado ancora una volta!"
	}
	D6.numDiceShownLast = D6.numDiceShown
	s = "Dadi per {0} punti, {1} da parte. ".format(puntiTiro, puntiMano)
	if (puntiMano+puntiTiro >= sogliaPunti) {
		s += "Puoi salvare {0} punti. ".format(puntiMano+puntiTiro)
		puntoDaAnnotare = true
		// Tiro libero, se accantoniamo tutti i dadi utili (risultati validi per il punteggio)
		if (D6.numDiceShown == punti[1])
			s+="Puoi rilanciare i dadi, se li salvi tutti."
	}
	else
		s += "Salva almeno un dado e accumula {0} punti o più per registrarli.".format(sogliaPunti)
	document.getElementById("infodiv1").innerHTML = "Hai salvato {0} punti tirando {1} volte con {2} Zilch.".format(puntiSalvati, tiriTotali, totZilch)
	if (puntiTiro)
		document.getElementById("infodiv2").innerHTML = s
    infoDiv()
}

var puntiSalvati, puntiMano, puntiTiro, wasZilch, totZilch, sequenzaZilch, doppio15
var dadiSalvati, tiriTotali, turniRimasti, puntoDaAnnotare
var Config

function resetGioco() {
	// Ritrova o crea la configurazione
	Config = getCookie('Config')
	if (Config == undefined) {
		Config = {'soglia300':true, 'usaZilch1':true, 'usaZilch3':true, 'combo3x2':true, 'combo456':true, 'scala6':true, 'doppio15':false}
		setCookie("Config", JSON.stringify(Config), 365)
	}
	D6.diceSaved = [] // dadi salvati in tutta la partita (array di array)
	D6.diceSavedLast = D6.diceSaved.length
	tiriTotali = 0
    puntiSalvati = 0
	totZilch=0
	sequenzaZilch=0
	resetTurno()
	document.getElementById("infodiv1").innerHTML = "&nbsp;"
	document.getElementById("infodiv2").innerHTML = "&nbsp;<br>&nbsp;"
    infoDiv()
}

function resetTurno() {
    D6.diceToShow(6)
    D6.inizioTurno = true
	D6.numDiceShownLast = 6
	D6.diceSelected = [] // dadi selezionati dopo un tiro
	wasZilch = false
    puntiMano = 0
    dadiSalvati = []
    puntoDaAnnotare = false
	doppio15=0
    for (i=1; i<D6.numDice+1; i++)
        document.getElementById('sdice'+i).src="blank.gif"
}

function infoDiv() {
}


function hallOfFame() {
    document.write('<html><body>')
    // javascript:history.back() non vale, poiché siamo tecnicamente nella stessa pagina... riscritta!
    document.write('<div style="text-align:center"><a href="index.html">(Torna al gioco)</a></div>')
    document.write('<h2>Migliori punteggi</h2>')
    document.write('<table style="width:40%">')
	document.write('<tr style="align:left"><th>Data</th><th>Punti</th><th>Tiri</th><th>Zilch</th></tr>')
    var p = getScore()
    for (var k in p) {
		document.write('<tr style="align:left"><td>{0}</td><td>{1}</td><td>{2}</td><td>{3}</td></tr>'.format(k, p[k][0],p[k][1],p[k][2]))
    }
    document.write('</table>')
    document.write('</body></html>')
}

// Recupera i punteggi annotati nel cookie
function getScore() {
	cookie = getCookie('Punti')
    if (cookie) {
		// Ordina i punteggi in base al punteggio medio per tiro
		Object.keys(cookie).sort((a, b) => cookie[b][0]/cookie[b][1] - cookie[a][0]/cookie[a][1])
		return cookie
	}
}

// Salva cronologicamente gli ultimi 100 punteggi
function storeScore() {
    punti = getScore()
    if (! punti) punti = {}
    if (Object.keys(punti).length == 100) {
        delete punti[Object.keys(punti)[0]]
    }
    punti[new Date().toLocaleString()] = [puntiSalvati, tiriTotali, totZilch]
    setCookie('Punti', JSON.stringify(punti), 3650)
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date()
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000))
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/"
}

function getCookie(cname) {
    cookie = document.cookie.split(';')
    var myCookie="", label=cname+'='
    for(i=0; i<cookie.length; i++) {
        t = cookie[i].trim()
        if (t.indexOf(label)==0)
            myCookie = t.substring(label.length, t.length)
    }
    if (myCookie)
        return JSON.parse(myCookie)

    return
}

function settings() {
	page = '<!DOCTYPE html><html><body>'
    page+='<div style="text-align:center"><a href="index.html">(Torna al gioco)</a></div>'
    page+='<h2>Impostazioni</h2>'
    page+='<h4>Configura la variante di Zilch che vuoi giocare, indicando quali regole adottare.</h4>'
    page+='<input onchange="update_settings()" type="checkbox" id="soglia300" {0}>Soglia di 300 punti a turno per registrare</input><br>'.format(Config.soglia300? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="usaZilch1" {0}>Bonus di 500 punti per Zilch a inizio turno</input><br>'.format(Config.usaZilch1? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="usaZilch3" {0}>Malus di 500 punti per tre Zilch consecutivi</input><br>'.format(Config.usaZilch3? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="combo456" {0}>Combinazione 4-5-6 di un tipo</input><br>'.format(Config.combo456? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="combo3x2" {0}>Combinazione tripla coppia</input><br>'.format(Config.combo3x2? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="scala6" {0}>Combinazione scala di 6 dadi</input><br>'.format(Config.scala6? 'checked':'')
    page+='<input onchange="update_settings()" type="checkbox" id="doppio15" {0}>Nuovo tiro del sesto dado dopo Zilch</input><br>'.format(Config.doppio15? 'checked':'')
	page+='<script type="text/javascript" src="d6.js"></script>'
	page+='<script type="text/javascript" src="game.js"></script>'
    page+='</body></html>'
	document.write(page)
	document.close()
}

// Aggiorna la configurazione secondo la selezione e la salva in Cookie
function update_settings() {
	Config = getCookie('Config')
	Config.soglia300 = document.getElementById("soglia300").checked
	Config.usaZilch1 = document.getElementById("usaZilch1").checked
	Config.usaZilch3 = document.getElementById("usaZilch3").checked
	Config.combo456 = document.getElementById("combo456").checked
	Config.combo3x2 = document.getElementById("combo3x2").checked
	Config.scala6 = document.getElementById("scala6").checked
	Config.doppio15 = document.getElementById("doppio15").checked
	setCookie("Config", JSON.stringify(Config), 365)
}
