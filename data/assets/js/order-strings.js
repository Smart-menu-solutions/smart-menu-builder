// UI chrome for the guest ordering panel/cart (SmartService Hub) - same
// 6-language set as quiz-strings.js/staff-strings.js. Dish names are
// translated separately via the menu's own translations object
// (itemTranslation()/orderItemDisplayName() in menu.js) - this file is only
// for the surrounding buttons/labels.
window.ORDER_STRINGS = {
	de: {
		currentOrder: 'Aktuelle Bestellung', recentlyOrdered: 'Zuletzt bestellt',
		callWaiter: '🔔 Kellner rufen', waiterCalled: '🔔 Kellner wurde gerufen',
		requestBill: '💳 Rechnung anfordern', billRequested: '💳 Rechnung angefragt',
		cartTitle: 'Warenkorb', cartEmpty: 'Noch leer.', notesPlaceholder: 'Anmerkung (optional)',
		sendOrder: 'Bestellung senden', sending: 'Wird gesendet…', added: '✓ Hinzugefügt', addToCart: '+ Warenkorb',
		orderFailed: 'Bestellung konnte nicht gesendet werden.'
	},
	en: {
		currentOrder: 'Current order', recentlyOrdered: 'Recently ordered',
		callWaiter: '🔔 Call waiter', waiterCalled: '🔔 Waiter called',
		requestBill: '💳 Request bill', billRequested: '💳 Bill requested',
		cartTitle: 'Cart', cartEmpty: 'Still empty.', notesPlaceholder: 'Note (optional)',
		sendOrder: 'Send order', sending: 'Sending…', added: '✓ Added', addToCart: '+ Cart',
		orderFailed: 'Could not send the order.'
	},
	el: {
		currentOrder: 'Τρέχουσα παραγγελία', recentlyOrdered: 'Πρόσφατη παραγγελία',
		callWaiter: '🔔 Κάλεσε σερβιτόρο', waiterCalled: '🔔 Ο σερβιτόρος ειδοποιήθηκε',
		requestBill: '💳 Ζήτα λογαριασμό', billRequested: '💳 Ζητήθηκε λογαριασμός',
		cartTitle: 'Καλάθι', cartEmpty: 'Ακόμα άδειο.', notesPlaceholder: 'Σημείωση (προαιρετικό)',
		sendOrder: 'Αποστολή παραγγελίας', sending: 'Αποστολή…', added: '✓ Προστέθηκε', addToCart: '+ Καλάθι',
		orderFailed: 'Η παραγγελία δεν στάλθηκε.'
	},
	it: {
		currentOrder: 'Ordine attuale', recentlyOrdered: 'Ordinati di recente',
		callWaiter: '🔔 Chiama cameriere', waiterCalled: '🔔 Cameriere chiamato',
		requestBill: '💳 Richiedi conto', billRequested: '💳 Conto richiesto',
		cartTitle: 'Carrello', cartEmpty: 'Ancora vuoto.', notesPlaceholder: 'Nota (opzionale)',
		sendOrder: 'Invia ordine', sending: 'Invio…', added: '✓ Aggiunto', addToCart: '+ Carrello',
		orderFailed: "Impossibile inviare l'ordine."
	},
	es: {
		currentOrder: 'Pedido actual', recentlyOrdered: 'Pedido recientemente',
		callWaiter: '🔔 Llamar al camarero', waiterCalled: '🔔 Camarero llamado',
		requestBill: '💳 Pedir la cuenta', billRequested: '💳 Cuenta solicitada',
		cartTitle: 'Carrito', cartEmpty: 'Todavía vacío.', notesPlaceholder: 'Nota (opcional)',
		sendOrder: 'Enviar pedido', sending: 'Enviando…', added: '✓ Añadido', addToCart: '+ Carrito',
		orderFailed: 'No se pudo enviar el pedido.'
	},
	fr: {
		currentOrder: 'Commande actuelle', recentlyOrdered: 'Commandé récemment',
		callWaiter: '🔔 Appeler le serveur', waiterCalled: '🔔 Serveur appelé',
		requestBill: '💳 Demander l’addition', billRequested: '💳 Addition demandée',
		cartTitle: 'Panier', cartEmpty: 'Encore vide.', notesPlaceholder: 'Remarque (optionnel)',
		sendOrder: 'Envoyer la commande', sending: 'Envoi…', added: '✓ Ajouté', addToCart: '+ Panier',
		orderFailed: "La commande n'a pas pu être envoyée."
	}
};
