// UI chrome strings for waiter/kitchen/bar/cashier - same 6-language set as
// quiz-strings.js (Smart Food Match), since that's what the guest menu
// already offers and staff.js's language switcher mirrors it. Dish names
// themselves are never translated here - they come from the menu's own
// source-language text, same as an order ticket in any real restaurant.
window.STAFF_STRINGS = {
	de: {
		roleLabels: { waiter: 'Kellner', kitchen: 'Küche', bar: 'Bar', cashier: 'Kasse' },
		live: 'Live', empty: 'Gerade keine aktiven Tische.', table: 'Tisch',
		drinksInfoOnly: 'Getränke (nur Info)', dishesInfoOnly: 'Speisen (nur Info)',
		allDone: 'Alles fertig', addItem: '+ Artikel', add: 'Hinzufügen',
		serveHere: 'Servieren an diesem Tisch', serveAt: 'Servieren an Tisch {n}',
		notesPlaceholder: 'Anmerkung (optional)', closeTable: 'Tisch schließen',
		closeConfirm: 'Tisch wirklich schließen? Das entfernt die Bestellung aus allen Ansichten.',
		callRow: '🔔 Ruft an einem Tisch', resolveCall: 'Erledigt',
			removeItem: 'Position löschen', removeConfirm: 'Diese Position wirklich löschen?',
		linkIncomplete: 'Dieser Link ist unvollständig.', linkInvalid: 'Dieser Link ist nicht mehr gültig.', actionFailed: 'Aktion fehlgeschlagen.',
		onboardingHeading: 'Smart ServiceHub – Zugangsdaten für {name}', tablesHeading: 'Tische (Gäste-QR-Codes)', staffHeading: 'Personal-Zugänge'
	},
	en: {
		roleLabels: { waiter: 'Waiter', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier' },
		live: 'Live', empty: 'No active tables right now.', table: 'Table',
		drinksInfoOnly: 'Drinks (info only)', dishesInfoOnly: 'Food (info only)',
		allDone: 'All done', addItem: '+ Item', add: 'Add',
		serveHere: 'Serve at this table', serveAt: 'Serve at table {n}',
		notesPlaceholder: 'Note (optional)', closeTable: 'Close table',
		closeConfirm: 'Really close this table? This removes the order from every view.',
		callRow: '🔔 A table is calling', resolveCall: 'Done',
			removeItem: 'Delete item', removeConfirm: 'Really delete this item?',
		linkIncomplete: 'This link is incomplete.', linkInvalid: 'This link is no longer valid.', actionFailed: 'Action failed.',
		onboardingHeading: 'Smart ServiceHub – access details for {name}', tablesHeading: 'Tables (guest QR codes)', staffHeading: 'Staff access'
	},
	el: {
		roleLabels: { waiter: 'Σερβιτόρος', kitchen: 'Κουζίνα', bar: 'Μπαρ', cashier: 'Ταμείο' },
		live: 'Ζωντανά', empty: 'Κανένα ενεργό τραπέζι αυτή τη στιγμή.', table: 'Τραπέζι',
		drinksInfoOnly: 'Ποτά (μόνο πληροφορία)', dishesInfoOnly: 'Φαγητό (μόνο πληροφορία)',
		allDone: 'Όλα έτοιμα', addItem: '+ Προσθήκη', add: 'Προσθήκη',
		serveHere: 'Σερβίρισμα σε αυτό το τραπέζι', serveAt: 'Σερβίρισμα στο τραπέζι {n}',
		notesPlaceholder: 'Σημείωση (προαιρετικό)', closeTable: 'Κλείσιμο τραπεζιού',
		closeConfirm: 'Κλείσιμο τραπεζιού; Η παραγγελία θα αφαιρεθεί από όλες τις προβολές.',
		callRow: '🔔 Ένα τραπέζι καλεί', resolveCall: 'Έγινε',
			removeItem: 'Διαγραφή προϊόντος', removeConfirm: 'Διαγραφή αυτού του προϊόντος;',
		linkIncomplete: 'Αυτός ο σύνδεσμος είναι ελλιπής.', linkInvalid: 'Αυτός ο σύνδεσμος δεν ισχύει πια.', actionFailed: 'Η ενέργεια απέτυχε.',
		onboardingHeading: 'Smart ServiceHub – στοιχεία πρόσβασης για {name}', tablesHeading: 'Τραπέζια (QR κωδικοί για πελάτες)', staffHeading: 'Πρόσβαση προσωπικού'
	},
	it: {
		roleLabels: { waiter: 'Cameriere', kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' },
		live: 'Live', empty: 'Nessun tavolo attivo al momento.', table: 'Tavolo',
		drinksInfoOnly: 'Bevande (solo info)', dishesInfoOnly: 'Cibo (solo info)',
		allDone: 'Tutto pronto', addItem: '+ Articolo', add: 'Aggiungi',
		serveHere: 'Servire a questo tavolo', serveAt: 'Servire al tavolo {n}',
		notesPlaceholder: 'Nota (opzionale)', closeTable: 'Chiudi tavolo',
		closeConfirm: 'Chiudere davvero il tavolo? L’ordine sparirà da tutte le viste.',
		callRow: '🔔 Un tavolo sta chiamando', resolveCall: 'Fatto',
			removeItem: 'Elimina articolo', removeConfirm: 'Eliminare davvero questo articolo?',
		linkIncomplete: 'Questo link è incompleto.', linkInvalid: 'Questo link non è più valido.', actionFailed: 'Azione non riuscita.',
		onboardingHeading: 'Smart ServiceHub – dati di accesso per {name}', tablesHeading: 'Tavoli (codici QR per gli ospiti)', staffHeading: 'Accesso per il personale'
	},
	es: {
		roleLabels: { waiter: 'Camarero', kitchen: 'Cocina', bar: 'Bar', cashier: 'Caja' },
		live: 'En vivo', empty: 'No hay mesas activas ahora mismo.', table: 'Mesa',
		drinksInfoOnly: 'Bebidas (solo info)', dishesInfoOnly: 'Comida (solo info)',
		allDone: 'Todo listo', addItem: '+ Artículo', add: 'Añadir',
		serveHere: 'Servir en esta mesa', serveAt: 'Servir en la mesa {n}',
		notesPlaceholder: 'Nota (opcional)', closeTable: 'Cerrar mesa',
		closeConfirm: '¿Cerrar esta mesa de verdad? El pedido desaparecerá de todas las vistas.',
		callRow: '🔔 Una mesa está llamando', resolveCall: 'Hecho',
			removeItem: 'Eliminar artículo', removeConfirm: '¿Eliminar este artículo de verdad?',
		linkIncomplete: 'Este enlace está incompleto.', linkInvalid: 'Este enlace ya no es válido.', actionFailed: 'La acción falló.',
		onboardingHeading: 'Smart ServiceHub – datos de acceso para {name}', tablesHeading: 'Mesas (códigos QR para clientes)', staffHeading: 'Acceso del personal'
	},
	fr: {
		roleLabels: { waiter: 'Serveur', kitchen: 'Cuisine', bar: 'Bar', cashier: 'Caisse' },
		live: 'En direct', empty: 'Aucune table active pour le moment.', table: 'Table',
		drinksInfoOnly: 'Boissons (info uniquement)', dishesInfoOnly: 'Plats (info uniquement)',
		allDone: 'Tout est prêt', addItem: '+ Article', add: 'Ajouter',
		serveHere: 'Servir à cette table', serveAt: 'Servir à la table {n}',
		notesPlaceholder: 'Remarque (optionnel)', closeTable: 'Fermer la table',
		closeConfirm: 'Vraiment fermer cette table ? La commande disparaîtra de toutes les vues.',
		callRow: '🔔 Une table appelle', resolveCall: 'Fait',
			removeItem: "Supprimer l'article", removeConfirm: 'Vraiment supprimer cet article ?',
		linkIncomplete: 'Ce lien est incomplet.', linkInvalid: "Ce lien n'est plus valide.", actionFailed: "L'action a échoué.",
		onboardingHeading: 'Smart ServiceHub – informations d’accès pour {name}', tablesHeading: 'Tables (codes QR pour les clients)', staffHeading: 'Accès du personnel'
	}
};
