// Semplice generatore di password eufoniche, lettere più numeri
// NON SICURO! Usa Math.random !
var consonanti = "bcdfghklmnprstvwxz"
var doppie = "bdfglmnpstz"
var vocali = "aeioujy"

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

function eupwgen(length, numbers) {
    var n = length - numbers
    var k=0 // flag consonante
    var pw=''
    
    if (length < 1 || length <= numbers)
        return "Bad length specified"

    while (n-- > 0) {
        var P = getRandomInt(100)
        if (pw.length > 0 && k == 0 && P < 15) { // doppia
            k=1
            pw += doppie[getRandomInt(doppie.length)]
        }
        else if (k == 0 && P < 95) { // consonante
            k=1
            pw += consonanti[getRandomInt(consonanti.length)]
        }
        else { // vocale
            k=0
            pw += vocali[getRandomInt(vocali.length)]
        }
    }
    
    while (numbers-- > 0) {
        pw += getRandomInt(10)
    }
    
    return pw
}

function html_pwtable_gen(n) {
    for (i=0; i < 25; i++) {
        document.write('<tr><td>' + i + '</td><td>' + eupwgen(8, 3) + '</td>')
    }
}

html_pwtable_gen(25)
