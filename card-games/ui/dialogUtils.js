// I dialoghi jQuery UI vengono agganciati a document.body, FUORI dal
// #game-board (che su smartphone e' rimpicciolito con un transform: scale).
// Una larghezza fissa in px (es. 500) e' quindi relativa alla finestra VERA
// del telefono, non al tavolo scalato: su uno schermo stretto risulta piu'
// larga della finestra stessa, e jQuery UI la centra comunque rispetto alla
// finestra, tagliandone una parte (di solito a sinistra, dove finisce fuori
// dal bordo). Questa funzione va usata come valore di `width` in ogni
// dialog({...}) al posto di un numero fisso.
export function responsiveDialogWidth(preferred) {
    const margin = 24 // spazio minimo ai lati anche sugli schermi piu' stretti
    return Math.max(260, Math.min(preferred, window.innerWidth - margin))
}
