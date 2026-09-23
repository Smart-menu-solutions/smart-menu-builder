// UI chrome strings for waiter/kitchen/bar/cashier - same 6-language set as
// quiz-strings.js (Smart Food Match), since that's what the guest menu
// already offers and staff.js's language switcher mirrors it. Dish names
// themselves are never translated here - they come from the menu's own
// source-language text, same as an order ticket in any real restaurant.
// "Admin Hub" (the former "Kellner" role) keeps its name untranslated in
// every language - see 0017_table_hub.sql / staff.js for what it does.
window.STAFF_STRINGS = {
	de: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Küche', bar: 'Bar', cashier: 'Kasse' },
		live: 'Live', empty: 'Gerade keine aktiven Tische.', hubEmptyOrder: 'Noch keine Bestellung.', table: 'Tisch',
		hubStatus: { FREE: 'Frei', ACTIVE: 'Aktiv', PAYMENT_PENDING: 'Besetzt' },
		allDone: 'Alles fertig', addItem: '+ Artikel', add: 'Hinzufügen',
		requestBill: '💳 Rechnung anfordern', billRequested: '💳 Rechnung angefragt', billFlagHint: 'Rechnung raus – bitte Tisch schließen',
		notesPlaceholder: 'Anmerkung (optional)', closeTable: 'Tisch schließen',
		closeConfirm: 'Tisch wirklich schließen? Das entfernt die Bestellung aus allen Ansichten.',
			removeItem: 'Position löschen', removeConfirm: '{item} wirklich löschen?',
			guideButton: 'Anleitung', guideTitle: 'So funktioniert’s',
			totalsButton: '📊 Gesamtübersicht', totalsHeading: 'Summe aller offenen Tische',
			guide: {
				waiter: [
					"Hier siehst du alle Tische als Kacheln: Orange = frei, Grün = aktiv, Rot = Rechnung angefordert.",
					"Neue Gäste an einem freien (orangen) Tisch? Kachel antippen aktiviert ihn sofort.",
					"Auf eine aktive Kachel tippen zeigt die Bestellung und erlaubt, Artikel hinzuzufügen.",
					"🔔 auf der Kachel = etwas ist fertig und wartet zum Abholen.",
					"Gast will zahlen, hat aber nicht über sein Handy Bescheid gegeben? Im Popup „Rechnung anfordern“ drücken – der Tisch wird rot, die Kasse sieht es sofort.",
					"Bezahlt wird an der Kasse – dort wird der Tisch danach auch wieder freigegeben, nicht hier."
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
					"🔔 Der Gast möchte zahlen.",
					"✕ = Position löschen (du wirst vorher gefragt).",
					"„Tisch schließen“ = der Gast hat bezahlt, der Tisch ist wieder frei.",
					"📊 Gesamtübersicht = Summe über alle gerade offenen Tische."
				]
			},
		linkIncomplete: 'Dieser Link ist unvollständig.', linkInvalid: 'Dieser Link ist nicht mehr gültig.', actionFailed: 'Aktion fehlgeschlagen.',
		onboardingHeading: 'Smart ServiceHub™ – Zugangsdaten für {name}', staffHeading: 'Personal-Zugänge'
	},
	en: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier' },
		live: 'Live', empty: 'No active tables right now.', hubEmptyOrder: 'No order yet.', table: 'Table',
		hubStatus: { FREE: 'Free', ACTIVE: 'Active', PAYMENT_PENDING: 'Occupied' },
		allDone: 'All done', addItem: '+ Item', add: 'Add',
		requestBill: '💳 Request bill', billRequested: '💳 Bill requested', billFlagHint: 'Bill is out - please close the table',
		notesPlaceholder: 'Note (optional)', closeTable: 'Close table',
		closeConfirm: 'Really close this table? This removes the order from every view.',
			removeItem: 'Delete item', removeConfirm: 'Really delete {item}?',
			guideButton: 'Guide', guideTitle: 'How it works',
			totalsButton: '📊 Overview', totalsHeading: 'Total of all open tables',
			guide: {
				waiter: [
					"All tables are shown as tiles: orange = free, green = active, red = bill requested.",
					"New guests at a free (orange) table? Tap the tile to activate it right away.",
					"Tap an active tile to see its order and add items.",
					"🔔 on a tile = something is ready and waiting to be picked up.",
					"Guest wants to pay but didn't say so via their phone? Tap \"Request bill\" in the popup - the tile turns red and the cashier sees it right away.",
					"Payment happens at the cashier - that's also where the table gets freed again, not here."
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
					"🔔 The guest wants to pay.",
					"✕ = delete an item (you will be asked first).",
					"“Close table” = the guest has paid, the table is free again.",
					"📊 Overview = the total across every table that's currently open."
				]
			},
		linkIncomplete: 'This link is incomplete.', linkInvalid: 'This link is no longer valid.', actionFailed: 'Action failed.',
		onboardingHeading: 'Smart ServiceHub™ – access details for {name}', staffHeading: 'Staff access'
	},
	el: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Κουζίνα', bar: 'Μπαρ', cashier: 'Ταμείο' },
		live: 'Ζωντανά', empty: 'Κανένα ενεργό τραπέζι αυτή τη στιγμή.', hubEmptyOrder: 'Καμία παραγγελία ακόμα.', table: 'Τραπέζι',
		hubStatus: { FREE: 'Ελεύθερο', ACTIVE: 'Ενεργό', PAYMENT_PENDING: 'Κατειλημμένο' },
		allDone: 'Όλα έτοιμα', addItem: '+ Προσθήκη', add: 'Προσθήκη',
		requestBill: '💳 Ζήτα λογαριασμό', billRequested: '💳 Ζητήθηκε λογαριασμός', billFlagHint: 'Ζητήθηκε ο λογαριασμός - κλείσε το τραπέζι',
		notesPlaceholder: 'Σημείωση (προαιρετικό)', closeTable: 'Κλείσιμο τραπεζιού',
		closeConfirm: 'Κλείσιμο τραπεζιού; Η παραγγελία θα αφαιρεθεί από όλες τις προβολές.',
			removeItem: 'Διαγραφή προϊόντος', removeConfirm: 'Διαγραφή του {item};',
			guideButton: 'Οδηγός', guideTitle: 'Πώς λειτουργεί',
			totalsButton: '📊 Σύνολο', totalsHeading: 'Σύνολο όλων των ανοιχτών τραπεζιών',
			guide: {
				waiter: [
					"Όλα τα τραπέζια εμφανίζονται ως πλακίδια: πορτοκαλί = ελεύθερο, πράσινο = ενεργό, κόκκινο = ζητήθηκε λογαριασμός.",
					"Νέοι πελάτες σε ελεύθερο (πορτοκαλί) τραπέζι; Πάτα το πλακίδιο για να το ενεργοποιήσεις αμέσως.",
					"Πάτα ένα ενεργό πλακίδιο για να δεις την παραγγελία και να προσθέσεις προϊόντα.",
					"🔔 σε πλακίδιο = κάτι είναι έτοιμο και περιμένει να το πάρεις.",
					"Ο πελάτης θέλει να πληρώσει αλλά δεν το έκανε από το κινητό του; Πάτα «Ζήτα λογαριασμό» στο popup - το πλακίδιο γίνεται κόκκινο και το ταμείο το βλέπει αμέσως.",
					"Η πληρωμή γίνεται στο ταμείο - εκεί ελευθερώνεται και το τραπέζι ξανά, όχι εδώ."
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
					"🔔 Ο πελάτης θέλει να πληρώσει.",
					"✕ = διαγραφή προϊόντος (θα σε ρωτήσει πρώτα).",
					"«Κλείσιμο τραπεζιού» = ο πελάτης πλήρωσε, το τραπέζι είναι ξανά ελεύθερο.",
					"📊 Σύνολο = το άθροισμα όλων των τραπεζιών που είναι αυτή τη στιγμή ανοιχτά."
				]
			},
		linkIncomplete: 'Αυτός ο σύνδεσμος είναι ελλιπής.', linkInvalid: 'Αυτός ο σύνδεσμος δεν ισχύει πια.', actionFailed: 'Η ενέργεια απέτυχε.',
		onboardingHeading: 'Smart ServiceHub™ – στοιχεία πρόσβασης για {name}', staffHeading: 'Πρόσβαση προσωπικού'
	},
	it: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' },
		live: 'Live', empty: 'Nessun tavolo attivo al momento.', hubEmptyOrder: 'Ancora nessun ordine.', table: 'Tavolo',
		hubStatus: { FREE: 'Libero', ACTIVE: 'Attivo', PAYMENT_PENDING: 'Occupato' },
		allDone: 'Tutto pronto', addItem: '+ Articolo', add: 'Aggiungi',
		requestBill: '💳 Richiedi conto', billRequested: '💳 Conto richiesto', billFlagHint: 'Conto richiesto - chiudi il tavolo',
		notesPlaceholder: 'Nota (opzionale)', closeTable: 'Chiudi tavolo',
		closeConfirm: 'Chiudere davvero il tavolo? L’ordine sparirà da tutte le viste.',
			removeItem: 'Elimina articolo', removeConfirm: 'Eliminare davvero {item}?',
			guideButton: 'Guida', guideTitle: 'Come funziona',
			totalsButton: '📊 Riepilogo', totalsHeading: 'Totale di tutti i tavoli aperti',
			guide: {
				waiter: [
					"Tutti i tavoli sono mostrati come riquadri: arancione = libero, verde = attivo, rosso = conto richiesto.",
					"Nuovi ospiti a un tavolo libero (arancione)? Tocca il riquadro per attivarlo subito.",
					"Tocca un riquadro attivo per vedere l'ordine e aggiungere articoli.",
					"🔔 sul riquadro = qualcosa è pronto e aspetta di essere ritirato.",
					"L'ospite vuole pagare ma non l'ha detto dal telefono? Tocca «Richiedi conto» nel popup - il riquadro diventa rosso e la cassa lo vede subito.",
					"Il pagamento avviene alla cassa - è lì che il tavolo viene liberato di nuovo, non qui."
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
					"🔔 L’ospite vuole pagare.",
					"✕ = elimina un articolo (prima ti viene chiesto).",
					"«Chiudi tavolo» = l’ospite ha pagato, il tavolo torna libero.",
					"📊 Riepilogo = il totale di tutti i tavoli attualmente aperti."
				]
			},
		linkIncomplete: 'Questo link è incompleto.', linkInvalid: 'Questo link non è più valido.', actionFailed: 'Azione non riuscita.',
		onboardingHeading: 'Smart ServiceHub™ – dati di accesso per {name}', staffHeading: 'Accesso per il personale'
	},
	es: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cocina', bar: 'Bar', cashier: 'Caja' },
		live: 'En vivo', empty: 'No hay mesas activas ahora mismo.', hubEmptyOrder: 'Todavía sin pedido.', table: 'Mesa',
		hubStatus: { FREE: 'Libre', ACTIVE: 'Activa', PAYMENT_PENDING: 'Ocupada' },
		allDone: 'Todo listo', addItem: '+ Artículo', add: 'Añadir',
		requestBill: '💳 Pedir la cuenta', billRequested: '💳 Cuenta solicitada', billFlagHint: 'Cuenta pedida - cierra la mesa',
		notesPlaceholder: 'Nota (opcional)', closeTable: 'Cerrar mesa',
		closeConfirm: '¿Cerrar esta mesa de verdad? El pedido desaparecerá de todas las vistas.',
			removeItem: 'Eliminar artículo', removeConfirm: '¿Eliminar {item} de verdad?',
			guideButton: 'Guía', guideTitle: 'Cómo funciona',
			totalsButton: '📊 Resumen', totalsHeading: 'Total de todas las mesas abiertas',
			guide: {
				waiter: [
					"Todas las mesas se muestran como fichas: naranja = libre, verde = activa, rojo = cuenta solicitada.",
					"¿Nuevos clientes en una mesa libre (naranja)? Toca la ficha para activarla al instante.",
					"Toca una ficha activa para ver el pedido y añadir artículos.",
					"🔔 en la ficha = algo está listo y espera a que lo recojas.",
					"¿El cliente quiere pagar pero no lo dijo desde su móvil? Pulsa «Pedir la cuenta» en el popup - la ficha se pone roja y caja lo ve al instante.",
					"El pago se hace en caja - ahí es también donde se libera la mesa de nuevo, no aquí."
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
					"🔔 El cliente quiere pagar.",
					"✕ = borrar un artículo (antes te preguntará).",
					"«Cerrar mesa» = el cliente ha pagado, la mesa queda libre.",
					"📊 Resumen = el total de todas las mesas abiertas ahora mismo."
				]
			},
		linkIncomplete: 'Este enlace está incompleto.', linkInvalid: 'Este enlace ya no es válido.', actionFailed: 'La acción falló.',
		onboardingHeading: 'Smart ServiceHub™ – datos de acceso para {name}', staffHeading: 'Acceso del personal'
	},
	fr: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cuisine', bar: 'Bar', cashier: 'Caisse' },
		live: 'En direct', empty: 'Aucune table active pour le moment.', hubEmptyOrder: 'Pas encore de commande.', table: 'Table',
		hubStatus: { FREE: 'Libre', ACTIVE: 'Active', PAYMENT_PENDING: 'Occupée' },
		allDone: 'Tout est prêt', addItem: '+ Article', add: 'Ajouter',
		requestBill: '💳 Demander l’addition', billRequested: '💳 Addition demandée', billFlagHint: 'Addition demandée - fermez la table',
		notesPlaceholder: 'Remarque (optionnel)', closeTable: 'Fermer la table',
		closeConfirm: 'Vraiment fermer cette table ? La commande disparaîtra de toutes les vues.',
			removeItem: "Supprimer l'article", removeConfirm: 'Vraiment supprimer {item} ?',
			guideButton: 'Guide', guideTitle: 'Comment ça marche',
			totalsButton: '📊 Vue d’ensemble', totalsHeading: 'Total de toutes les tables ouvertes',
			guide: {
				waiter: [
					"Toutes les tables sont affichées en tuiles : orange = libre, vert = active, rouge = addition demandée.",
					"Nouveaux clients à une table libre (orange) ? Touchez la tuile pour l'activer immédiatement.",
					"Touchez une tuile active pour voir la commande et ajouter des articles.",
					"🔔 sur une tuile = quelque chose est prêt et attend d'être récupéré.",
					"Le client veut payer mais ne l'a pas dit via son téléphone ? Appuyez sur « Demander l'addition » dans la fenêtre - la tuile devient rouge et la caisse le voit tout de suite.",
					"Le paiement se fait à la caisse - c'est aussi là que la table est libérée à nouveau, pas ici."
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
					"🔔 Le client veut payer.",
					"✕ = supprimer un article (une confirmation est demandée).",
					"« Fermer la table » = le client a payé, la table est de nouveau libre.",
					"📊 Vue d'ensemble = le total de toutes les tables actuellement ouvertes."
				]
			},
		linkIncomplete: 'Ce lien est incomplet.', linkInvalid: "Ce lien n'est plus valide.", actionFailed: "L'action a échoué.",
		onboardingHeading: 'Smart ServiceHub™ – informations d’accès pour {name}', staffHeading: 'Accès du personnel'
	}
};
