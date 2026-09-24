// UI chrome for the guest ordering panel/cart (SmartService Hub) - same
// 6-language set as quiz-strings.js/staff-strings.js. Dish names are
// translated separately via the menu's own translations object
// (itemTranslation()/orderItemDisplayName() in menu.js) - this file is only
// for the surrounding buttons/labels.
window.ORDER_STRINGS = {
	de: {
		currentOrder: 'Aktuelle Bestellung', recentlyOrdered: 'Zuletzt bestellt',
		requestBill: '💳 Rechnung anfordern', billRequested: '💳 Rechnung angefragt',
		notActiveYet: 'Dieser Tisch ist noch nicht aktiv. Bitte das Personal um Aktivierung bitten.',
		cartTitle: 'Warenkorb', cartEmpty: 'Noch leer.', notesPlaceholder: 'Anmerkung (optional)',
		orderButton: 'Bestellen',
		sendOrder: 'Bestellung senden', sending: 'Wird gesendet…', added: '✓ Hinzugefügt', addToCart: '+ Warenkorb',
		orderFailed: 'Bestellung konnte nicht gesendet werden.', total: 'Gesamt'
	},
	en: {
		currentOrder: 'Current order', recentlyOrdered: 'Recently ordered',
		requestBill: '💳 Request bill', billRequested: '💳 Bill requested',
		notActiveYet: 'This table is not active yet. Please ask staff to activate it.',
		cartTitle: 'Cart', cartEmpty: 'Still empty.', notesPlaceholder: 'Note (optional)',
		orderButton: 'Order',
		sendOrder: 'Send order', sending: 'Sending…', added: '✓ Added', addToCart: '+ Cart',
		orderFailed: 'Could not send the order.', total: 'Total'
	},
	el: {
		currentOrder: 'Τρέχουσα παραγγελία', recentlyOrdered: 'Πρόσφατη παραγγελία',
		requestBill: '💳 Ζήτα λογαριασμό', billRequested: '💳 Ζητήθηκε λογαριασμός',
		notActiveYet: 'Αυτό το τραπέζι δεν είναι ακόμα ενεργό. Ζήτα από το προσωπικό να το ενεργοποιήσει.',
		cartTitle: 'Καλάθι', cartEmpty: 'Ακόμα άδειο.', notesPlaceholder: 'Σημείωση (προαιρετικό)',
		orderButton: 'Παραγγελία',
		sendOrder: 'Αποστολή παραγγελίας', sending: 'Αποστολή…', added: '✓ Προστέθηκε', addToCart: '+ Καλάθι',
		orderFailed: 'Η παραγγελία δεν στάλθηκε.', total: 'Σύνολο'
	},
	it: {
		currentOrder: 'Ordine attuale', recentlyOrdered: 'Ordinati di recente',
		requestBill: '💳 Richiedi conto', billRequested: '💳 Conto richiesto',
		notActiveYet: 'Questo tavolo non è ancora attivo. Chiedi al personale di attivarlo.',
		cartTitle: 'Carrello', cartEmpty: 'Ancora vuoto.', notesPlaceholder: 'Nota (opzionale)',
		orderButton: 'Ordina',
		sendOrder: 'Invia ordine', sending: 'Invio…', added: '✓ Aggiunto', addToCart: '+ Carrello',
		orderFailed: "Impossibile inviare l'ordine.", total: 'Totale'
	},
	es: {
		currentOrder: 'Pedido actual', recentlyOrdered: 'Pedido recientemente',
		requestBill: '💳 Pedir la cuenta', billRequested: '💳 Cuenta solicitada',
		notActiveYet: 'Esta mesa aún no está activa. Pide al personal que la active.',
		cartTitle: 'Carrito', cartEmpty: 'Todavía vacío.', notesPlaceholder: 'Nota (opcional)',
		orderButton: 'Pedir',
		sendOrder: 'Enviar pedido', sending: 'Enviando…', added: '✓ Añadido', addToCart: '+ Carrito',
		orderFailed: 'No se pudo enviar el pedido.', total: 'Total'
	},
	fr: {
		currentOrder: 'Commande actuelle', recentlyOrdered: 'Commandé récemment',
		requestBill: '💳 Demander l’addition', billRequested: '💳 Addition demandée',
		notActiveYet: "Cette table n'est pas encore active. Demandez au personnel de l'activer.",
		cartTitle: 'Panier', cartEmpty: 'Encore vide.', notesPlaceholder: 'Remarque (optionnel)',
		orderButton: 'Commander',
		sendOrder: 'Envoyer la commande', sending: 'Envoi…', added: '✓ Ajouté', addToCart: '+ Panier',
		orderFailed: "La commande n'a pas pu être envoyée.", total: 'Total'
	}
};
