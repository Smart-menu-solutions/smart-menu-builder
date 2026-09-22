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
			removeItem: 'Position löschen', removeConfirm: '{item} wirklich löschen?',
			guideButton: 'Anleitung', guideTitle: 'So funktioniert’s',
			guide: {
				waiter: [
					"Hier siehst du alle Tische mit ihren Bestellungen.",
					"Rot = noch nicht fertig. Grün = fertig.",
					"🔔 Ein Gast ruft dich. Danach auf „Erledigt“ tippen.",
					"💳 Der Gast möchte zahlen.",
					"„+ Artikel“ = etwas zu einem Tisch hinzufügen."
				],
				kitchen: [
					"Hier siehst du, was die Gäste bestellt haben.",
					"Rot = noch zu machen. Tippe auf die Zeile, wenn es fertig ist. Dann wird sie grün.",
					"„Alles fertig“ = alles für diesen Tisch ist fertig.",
					"Neue Bestellungen kommen von selbst."
				],
				bar: [
					"Hier siehst du, welche Getränke bestellt wurden.",
					"Rot = noch zu machen. Tippe auf die Zeile, wenn es fertig ist. Dann wird sie grün.",
					"„Alles fertig“ = alle Getränke für diesen Tisch sind fertig.",
					"Neue Bestellungen kommen von selbst."
				],
				cashier: [
					"Hier siehst du alle Tische mit Preisen und Summe.",
					"💳 Der Gast möchte zahlen.",
					"✕ = Position löschen (du wirst vorher gefragt).",
					"„Tisch schließen“ = der Gast hat bezahlt, der Tisch ist wieder frei."
				]
			},
		linkIncomplete: 'Dieser Link ist unvollständig.', linkInvalid: 'Dieser Link ist nicht mehr gültig.', actionFailed: 'Aktion fehlgeschlagen.',
		onboardingHeading: 'Smart ServiceHub™ – Zugangsdaten für {name}', tablesHeading: 'Tische (Gäste-QR-Codes)', staffHeading: 'Personal-Zugänge'
	},
	en: {
		roleLabels: { waiter: 'Service', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier' },
		live: 'Live', empty: 'No active tables right now.', table: 'Table',
		drinksInfoOnly: 'Drinks (info only)', dishesInfoOnly: 'Food (info only)',
		allDone: 'All done', addItem: '+ Item', add: 'Add',
		serveHere: 'Serve at this table', serveAt: 'Serve at table {n}',
		notesPlaceholder: 'Note (optional)', closeTable: 'Close table',
		closeConfirm: 'Really close this table? This removes the order from every view.',
		callRow: '🔔 A table is calling', resolveCall: 'Done',
			removeItem: 'Delete item', removeConfirm: 'Really delete {item}?',
			guideButton: 'Guide', guideTitle: 'How it works',
			guide: {
				waiter: [
					"All tables with their orders are shown here.",
					"Red = not ready yet. Green = ready.",
					"🔔 A guest is calling you. Tap “Done” afterwards.",
					"💳 The guest wants to pay.",
					"“+ Item” = add something to a table."
				],
				kitchen: [
					"Here you see what the guests ordered.",
					"Red = still to make. Tap the row when it is ready. Then it turns green.",
					"“All done” = everything for this table is ready.",
					"New orders arrive by themselves."
				],
				bar: [
					"Here you see which drinks were ordered.",
					"Red = still to make. Tap the row when it is ready. Then it turns green.",
					"“All done” = all drinks for this table are ready.",
					"New orders arrive by themselves."
				],
				cashier: [
					"All tables with prices and the total are shown here.",
					"💳 The guest wants to pay.",
					"✕ = delete an item (you will be asked first).",
					"“Close table” = the guest has paid, the table is free again."
				]
			},
		linkIncomplete: 'This link is incomplete.', linkInvalid: 'This link is no longer valid.', actionFailed: 'Action failed.',
		onboardingHeading: 'Smart ServiceHub™ – access details for {name}', tablesHeading: 'Tables (guest QR codes)', staffHeading: 'Staff access'
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
			removeItem: 'Διαγραφή προϊόντος', removeConfirm: 'Διαγραφή του {item};',
			guideButton: 'Οδηγός', guideTitle: 'Πώς λειτουργεί',
			guide: {
				waiter: [
					"Εδώ βλέπεις όλα τα τραπέζια με τις παραγγελίες τους.",
					"Κόκκινο = δεν είναι έτοιμο. Πράσινο = έτοιμο.",
					"🔔 Ένας πελάτης σε καλεί. Μετά πάτα «Έγινε».",
					"💳 Ο πελάτης θέλει να πληρώσει.",
					"«+ Προσθήκη» = πρόσθεσε κάτι σε ένα τραπέζι."
				],
				kitchen: [
					"Εδώ βλέπεις τι παρήγγειλαν οι πελάτες.",
					"Κόκκινο = ακόμα να γίνει. Πάτα τη γραμμή όταν είναι έτοιμο. Τότε γίνεται πράσινη.",
					"«Όλα έτοιμα» = όλα για αυτό το τραπέζι είναι έτοιμα.",
					"Οι νέες παραγγελίες έρχονται μόνες τους."
				],
				bar: [
					"Εδώ βλέπεις ποια ποτά παραγγέλθηκαν.",
					"Κόκκινο = ακόμα να γίνει. Πάτα τη γραμμή όταν είναι έτοιμο. Τότε γίνεται πράσινη.",
					"«Όλα έτοιμα» = όλα τα ποτά για αυτό το τραπέζι είναι έτοιμα.",
					"Οι νέες παραγγελίες έρχονται μόνες τους."
				],
				cashier: [
					"Εδώ βλέπεις όλα τα τραπέζια με τιμές και σύνολο.",
					"💳 Ο πελάτης θέλει να πληρώσει.",
					"✕ = διαγραφή προϊόντος (θα σε ρωτήσει πρώτα).",
					"«Κλείσιμο τραπεζιού» = ο πελάτης πλήρωσε, το τραπέζι είναι ξανά ελεύθερο."
				]
			},
		linkIncomplete: 'Αυτός ο σύνδεσμος είναι ελλιπής.', linkInvalid: 'Αυτός ο σύνδεσμος δεν ισχύει πια.', actionFailed: 'Η ενέργεια απέτυχε.',
		onboardingHeading: 'Smart ServiceHub™ – στοιχεία πρόσβασης για {name}', tablesHeading: 'Τραπέζια (QR κωδικοί για πελάτες)', staffHeading: 'Πρόσβαση προσωπικού'
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
			removeItem: 'Elimina articolo', removeConfirm: 'Eliminare davvero {item}?',
			guideButton: 'Guida', guideTitle: 'Come funziona',
			guide: {
				waiter: [
					"Qui vedi tutti i tavoli con le loro ordinazioni.",
					"Rosso = non ancora pronto. Verde = pronto.",
					"🔔 Un ospite ti chiama. Poi tocca «Fatto».",
					"💳 L’ospite vuole pagare.",
					"«+ Articolo» = aggiungi qualcosa a un tavolo."
				],
				kitchen: [
					"Qui vedi cosa hanno ordinato gli ospiti.",
					"Rosso = ancora da fare. Tocca la riga quando è pronto. Poi diventa verde.",
					"«Tutto pronto» = tutto per questo tavolo è pronto.",
					"Le nuove ordinazioni arrivano da sole."
				],
				bar: [
					"Qui vedi quali bevande sono state ordinate.",
					"Rosso = ancora da fare. Tocca la riga quando è pronto. Poi diventa verde.",
					"«Tutto pronto» = tutte le bevande di questo tavolo sono pronte.",
					"Le nuove ordinazioni arrivano da sole."
				],
				cashier: [
					"Qui vedi tutti i tavoli con prezzi e totale.",
					"💳 L’ospite vuole pagare.",
					"✕ = elimina un articolo (prima ti viene chiesto).",
					"«Chiudi tavolo» = l’ospite ha pagato, il tavolo torna libero."
				]
			},
		linkIncomplete: 'Questo link è incompleto.', linkInvalid: 'Questo link non è più valido.', actionFailed: 'Azione non riuscita.',
		onboardingHeading: 'Smart ServiceHub™ – dati di accesso per {name}', tablesHeading: 'Tavoli (codici QR per gli ospiti)', staffHeading: 'Accesso per il personale'
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
			removeItem: 'Eliminar artículo', removeConfirm: '¿Eliminar {item} de verdad?',
			guideButton: 'Guía', guideTitle: 'Cómo funciona',
			guide: {
				waiter: [
					"Aquí ves todas las mesas con sus pedidos.",
					"Rojo = aún no está listo. Verde = listo.",
					"🔔 Un cliente te llama. Después pulsa «Hecho».",
					"💳 El cliente quiere pagar.",
					"«+ Artículo» = añade algo a una mesa."
				],
				kitchen: [
					"Aquí ves lo que han pedido los clientes.",
					"Rojo = aún por hacer. Pulsa la fila cuando esté listo. Entonces se vuelve verde.",
					"«Todo listo» = todo lo de esta mesa está listo.",
					"Los pedidos nuevos llegan solos."
				],
				bar: [
					"Aquí ves qué bebidas se han pedido.",
					"Rojo = aún por hacer. Pulsa la fila cuando esté listo. Entonces se vuelve verde.",
					"«Todo listo» = todas las bebidas de esta mesa están listas.",
					"Los pedidos nuevos llegan solos."
				],
				cashier: [
					"Aquí ves todas las mesas con precios y total.",
					"💳 El cliente quiere pagar.",
					"✕ = borrar un artículo (antes te preguntará).",
					"«Cerrar mesa» = el cliente ha pagado, la mesa queda libre."
				]
			},
		linkIncomplete: 'Este enlace está incompleto.', linkInvalid: 'Este enlace ya no es válido.', actionFailed: 'La acción falló.',
		onboardingHeading: 'Smart ServiceHub™ – datos de acceso para {name}', tablesHeading: 'Mesas (códigos QR para clientes)', staffHeading: 'Acceso del personal'
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
			removeItem: "Supprimer l'article", removeConfirm: 'Vraiment supprimer {item} ?',
			guideButton: 'Guide', guideTitle: 'Comment ça marche',
			guide: {
				waiter: [
					"Vous voyez ici toutes les tables avec leurs commandes.",
					"Rouge = pas encore prêt. Vert = prêt.",
					"🔔 Un client vous appelle. Ensuite, appuyez sur « Fait ».",
					"💳 Le client veut payer.",
					"« + Article » = ajouter quelque chose à une table."
				],
				kitchen: [
					"Vous voyez ici ce que les clients ont commandé.",
					"Rouge = reste à faire. Appuyez sur la ligne quand c’est prêt. Elle devient verte.",
					"« Tout est prêt » = tout est prêt pour cette table.",
					"Les nouvelles commandes arrivent toutes seules."
				],
				bar: [
					"Vous voyez ici les boissons commandées.",
					"Rouge = reste à faire. Appuyez sur la ligne quand c’est prêt. Elle devient verte.",
					"« Tout est prêt » = toutes les boissons de cette table sont prêtes.",
					"Les nouvelles commandes arrivent toutes seules."
				],
				cashier: [
					"Vous voyez ici toutes les tables avec prix et total.",
					"💳 Le client veut payer.",
					"✕ = supprimer un article (une confirmation est demandée).",
					"« Fermer la table » = le client a payé, la table est de nouveau libre."
				]
			},
		linkIncomplete: 'Ce lien est incomplet.', linkInvalid: "Ce lien n'est plus valide.", actionFailed: "L'action a échoué.",
		onboardingHeading: 'Smart ServiceHub™ – informations d’accès pour {name}', tablesHeading: 'Tables (codes QR pour les clients)', staffHeading: 'Accès du personnel'
	}
};
