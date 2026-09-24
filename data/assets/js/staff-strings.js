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
		notesPlaceholder: 'Anmerkung (optional)', closeTable: 'Tisch schließen', deactivateTable: 'Tisch wieder freigeben', activateTable: 'Aktivieren',
		closeConfirm: 'Tisch wirklich schließen? Das entfernt die Bestellung aus allen Ansichten.',
			removeItem: 'Position löschen', removeConfirm: '{item} wirklich löschen?',
			guideButton: 'Anleitung', guideTitle: 'So funktioniert’s',
			totalsButton: '📊 Gesamtübersicht', totalsHeading: 'Summe aller offenen Tische',
			workflowButton: 'Ablauf', workflowTitle: 'So läuft der ganze Ablauf',
			workflow: [
				"Gäste scannen den QR-Code am Tisch - das Menü öffnet sich, aber bestellen geht erst nach der Aktivierung.",
				"Im Admin Hub auf den freien (grünen) Tisch tippen und „Aktivieren“ drücken.",
				"Ab jetzt bestellt jeder Gast über sein eigenes Handy - alle Bestellungen landen zusammen am selben Tisch.",
				"Artikel werden automatisch an Küche oder Bar verteilt, je nachdem was bestellt wurde.",
				"Küche und Bar sehen ihre Artikel als Liste und markieren sie als fertig.",
				"Gäste sehen live auf ihrem Handy, was schon fertig ist, inklusive Preis und Summe.",
				"Gäste können jederzeit nachbestellen, ohne das Menü neu zu scannen.",
				"Rechnung anfordern - entweder der Gast selbst am Handy oder das Personal im Admin Hub.",
				"Der Tisch wird rot, 💳 erscheint bei der Kasse.",
				"Kasse prüft die Bestellung, kassiert, drückt „Tisch schließen“ - der Tisch ist sofort wieder frei, derselbe QR-Code bleibt für den nächsten Gast gültig."
			],
			guide: {
				waiter: [
					"Hier siehst du alle Tische als Kacheln: Grün = frei, Orange = aktiv, Rot = Rechnung angefordert.",
					"Neue Gäste an einem freien (grünen) Tisch? Kachel antippen zeigt ein Popup mit „Aktivieren“ - erst dieser Klick öffnet den Tisch wirklich.",
					"Auf eine aktive Kachel tippen zeigt die Bestellung und erlaubt, Artikel hinzuzufügen.",
					"🛎️ auf der Kachel = etwas ist fertig und wartet zum Abholen.",
					"Gast will zahlen, hat aber nicht über sein Handy Bescheid gegeben? Im Popup „Rechnung anfordern“ drücken – der Tisch wird rot, die Kasse sieht es sofort.",
					"Bezahlt wird an der Kasse – dort wird der Tisch danach wieder freigegeben. Nur ein aus Versehen aktivierter, noch leerer Tisch lässt sich direkt hier über „Tisch wieder freigeben“ zurücksetzen."
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
					"„Tisch schließen“ = der Gast hat bezahlt, der Tisch ist wieder frei.",
					"📊 Gesamtübersicht = Summe über alle gerade offenen Tische."
				]
			},
		offline: 'Keine Internetverbindung. Die Seite lädt automatisch neu, sobald du wieder online bist.',
		linkIncomplete: 'Dieser Link ist unvollständig.', linkInvalid: 'Dieser Link ist nicht mehr gültig.', actionFailed: 'Aktion fehlgeschlagen.',
		onboardingHeading: 'Smart ServiceHub™ – Zugangsdaten für {name}', staffHeading: 'Personal-Zugänge'
	},
	en: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier' },
		live: 'Live', empty: 'No active tables right now.', hubEmptyOrder: 'No order yet.', table: 'Table',
		hubStatus: { FREE: 'Free', ACTIVE: 'Active', PAYMENT_PENDING: 'Occupied' },
		allDone: 'All done', addItem: '+ Item', add: 'Add',
		requestBill: '💳 Request bill', billRequested: '💳 Bill requested', billFlagHint: 'Bill is out - please close the table',
		notesPlaceholder: 'Note (optional)', closeTable: 'Close table', deactivateTable: 'Free this table again', activateTable: 'Activate',
		closeConfirm: 'Really close this table? This removes the order from every view.',
			removeItem: 'Delete item', removeConfirm: 'Really delete {item}?',
			guideButton: 'Guide', guideTitle: 'How it works',
			totalsButton: '📊 Overview', totalsHeading: 'Total of all open tables',
			workflowButton: 'Workflow', workflowTitle: 'How the whole flow works',
			workflow: [
				"Guests scan the QR code on the table - the menu opens, but ordering only works after activation.",
				"Tap the free (green) table in the Admin Hub and press \"Activate\".",
				"From then on, every guest orders from their own phone - all orders land together on the same table.",
				"Items are automatically split between kitchen and bar, based on what was ordered.",
				"Kitchen and bar see their items as a list and mark them done.",
				"Guests see live on their phone what's ready, including price and total.",
				"Guests can reorder any time without scanning the menu again.",
				"Request the bill - either the guest themselves on their phone, or staff in the Admin Hub.",
				"The table turns red, 💳 shows up at the cashier.",
				"The cashier checks the order, takes payment, and taps \"Close table\" - the table is free again right away, and the same QR code stays valid for the next guest."
			],
			guide: {
				waiter: [
					"All tables are shown as tiles: green = free, orange = active, red = bill requested.",
					"New guests at a free (green) table? Tap the tile to see a popup with \"Activate\" - that button is what actually opens the table.",
					"Tap an active tile to see its order and add items.",
					"🛎️ on a tile = something is ready and waiting to be picked up.",
					"Guest wants to pay but didn't say so via their phone? Tap \"Request bill\" in the popup - the tile turns red and the cashier sees it right away.",
					"Payment happens at the cashier - that's also where the table gets freed again. Only a table you activated by mistake and that's still empty can be freed right here, via \"Free this table again\"."
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
					"“Close table” = the guest has paid, the table is free again.",
					"📊 Overview = the total across every table that's currently open."
				]
			},
		offline: 'No internet connection. This page reloads automatically once you are back online.',
		linkIncomplete: 'This link is incomplete.', linkInvalid: 'This link is no longer valid.', actionFailed: 'Action failed.',
		onboardingHeading: 'Smart ServiceHub™ – access details for {name}', staffHeading: 'Staff access'
	},
	el: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Κουζίνα', bar: 'Μπαρ', cashier: 'Ταμείο' },
		live: 'Ζωντανά', empty: 'Κανένα ενεργό τραπέζι αυτή τη στιγμή.', hubEmptyOrder: 'Καμία παραγγελία ακόμα.', table: 'Τραπέζι',
		hubStatus: { FREE: 'Ελεύθερο', ACTIVE: 'Ενεργό', PAYMENT_PENDING: 'Κατειλημμένο' },
		allDone: 'Όλα έτοιμα', addItem: '+ Προσθήκη', add: 'Προσθήκη',
		requestBill: '💳 Ζήτα λογαριασμό', billRequested: '💳 Ζητήθηκε λογαριασμός', billFlagHint: 'Ζητήθηκε ο λογαριασμός - κλείσε το τραπέζι',
		notesPlaceholder: 'Σημείωση (προαιρετικό)', closeTable: 'Κλείσιμο τραπεζιού', deactivateTable: 'Ελευθέρωσε ξανά το τραπέζι', activateTable: 'Ενεργοποίηση',
		closeConfirm: 'Κλείσιμο τραπεζιού; Η παραγγελία θα αφαιρεθεί από όλες τις προβολές.',
			removeItem: 'Διαγραφή προϊόντος', removeConfirm: 'Διαγραφή του {item};',
			guideButton: 'Οδηγός', guideTitle: 'Πώς λειτουργεί',
			totalsButton: '📊 Σύνολο', totalsHeading: 'Σύνολο όλων των ανοιχτών τραπεζιών',
			workflowButton: 'Ροή', workflowTitle: 'Πώς λειτουργεί όλη η διαδικασία',
			workflow: [
				"Οι πελάτες σκανάρουν τον κωδικό QR στο τραπέζι - το μενού ανοίγει, αλλά η παραγγελία λειτουργεί μόνο μετά την ενεργοποίηση.",
				"Πάτα το ελεύθερο (πράσινο) τραπέζι στο Admin Hub και πάτα «Ενεργοποίηση».",
				"Από εκεί και πέρα κάθε πελάτης παραγγέλνει από το δικό του κινητό - όλες οι παραγγελίες πάνε μαζί στο ίδιο τραπέζι.",
				"Τα προϊόντα μοιράζονται αυτόματα σε κουζίνα ή μπαρ, ανάλογα με το τι παραγγέλθηκε.",
				"Κουζίνα και μπαρ βλέπουν τα προϊόντα τους ως λίστα και τα σημειώνουν έτοιμα.",
				"Οι πελάτες βλέπουν ζωντανά στο κινητό τους τι είναι έτοιμο, με τιμή και σύνολο.",
				"Οι πελάτες μπορούν να ξαναπαραγγείλουν ανά πάσα στιγμή, χωρίς να σκανάρουν ξανά το μενού.",
				"Ζήτα τον λογαριασμό - είτε ο ίδιος ο πελάτης από το κινητό, είτε το προσωπικό από το Admin Hub.",
				"Το τραπέζι γίνεται κόκκινο, το 💳 εμφανίζεται στο ταμείο.",
				"Το ταμείο ελέγχει την παραγγελία, εισπράττει, πατάει «Κλείσιμο τραπεζιού» - το τραπέζι ελευθερώνεται αμέσως, ο ίδιος κωδικός QR παραμένει έγκυρος για τον επόμενο πελάτη."
			],
			guide: {
				waiter: [
					"Όλα τα τραπέζια εμφανίζονται ως πλακίδια: πράσινο = ελεύθερο, πορτοκαλί = ενεργό, κόκκινο = ζητήθηκε λογαριασμός.",
					"Νέοι πελάτες σε ελεύθερο (πράσινο) τραπέζι; Πάτα το πλακίδιο για να δεις ένα popup με «Ενεργοποίηση» - μόνο αυτό το κουμπί ανοίγει πραγματικά το τραπέζι.",
					"Πάτα ένα ενεργό πλακίδιο για να δεις την παραγγελία και να προσθέσεις προϊόντα.",
					"🛎️ σε πλακίδιο = κάτι είναι έτοιμο και περιμένει να το πάρεις.",
					"Ο πελάτης θέλει να πληρώσει αλλά δεν το έκανε από το κινητό του; Πάτα «Ζήτα λογαριασμό» στο popup - το πλακίδιο γίνεται κόκκινο και το ταμείο το βλέπει αμέσως.",
					"Η πληρωμή γίνεται στο ταμείο - εκεί ελευθερώνεται το τραπέζι ξανά. Μόνο ένα τραπέζι που ενεργοποιήθηκε κατά λάθος και είναι ακόμα άδειο μπορεί να ελευθερωθεί εδώ, με «Ελευθέρωσε ξανά το τραπέζι»."
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
					"«Κλείσιμο τραπεζιού» = ο πελάτης πλήρωσε, το τραπέζι είναι ξανά ελεύθερο.",
					"📊 Σύνολο = το άθροισμα όλων των τραπεζιών που είναι αυτή τη στιγμή ανοιχτά."
				]
			},
		offline: 'Δεν υπάρχει σύνδεση στο διαδίκτυο. Η σελίδα θα ανανεωθεί αυτόματα μόλις συνδεθείτε ξανά.',
		linkIncomplete: 'Αυτός ο σύνδεσμος είναι ελλιπής.', linkInvalid: 'Αυτός ο σύνδεσμος δεν ισχύει πια.', actionFailed: 'Η ενέργεια απέτυχε.',
		onboardingHeading: 'Smart ServiceHub™ – στοιχεία πρόσβασης για {name}', staffHeading: 'Πρόσβαση προσωπικού'
	},
	it: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' },
		live: 'Live', empty: 'Nessun tavolo attivo al momento.', hubEmptyOrder: 'Ancora nessun ordine.', table: 'Tavolo',
		hubStatus: { FREE: 'Libero', ACTIVE: 'Attivo', PAYMENT_PENDING: 'Occupato' },
		allDone: 'Tutto pronto', addItem: '+ Articolo', add: 'Aggiungi',
		requestBill: '💳 Richiedi conto', billRequested: '💳 Conto richiesto', billFlagHint: 'Conto richiesto - chiudi il tavolo',
		notesPlaceholder: 'Nota (opzionale)', closeTable: 'Chiudi tavolo', deactivateTable: 'Libera di nuovo il tavolo', activateTable: 'Attiva',
		closeConfirm: 'Chiudere davvero il tavolo? L’ordine sparirà da tutte le viste.',
			removeItem: 'Elimina articolo', removeConfirm: 'Eliminare davvero {item}?',
			guideButton: 'Guida', guideTitle: 'Come funziona',
			totalsButton: '📊 Riepilogo', totalsHeading: 'Totale di tutti i tavoli aperti',
			workflowButton: 'Flusso', workflowTitle: 'Come funziona l’intero processo',
			workflow: [
				"Gli ospiti scansionano il codice QR al tavolo - il menu si apre, ma si può ordinare solo dopo l'attivazione.",
				"Tocca il tavolo libero (verde) nell'Admin Hub e premi «Attiva».",
				"Da quel momento ogni ospite ordina dal proprio telefono - tutti gli ordini finiscono insieme sullo stesso tavolo.",
				"Gli articoli vengono divisi automaticamente tra cucina e bar, in base a cosa è stato ordinato.",
				"Cucina e bar vedono i propri articoli come una lista e li segnano come pronti.",
				"Gli ospiti vedono in tempo reale sul telefono cosa è pronto, incluso prezzo e totale.",
				"Gli ospiti possono riordinare in qualsiasi momento senza scansionare di nuovo il menu.",
				"Richiedi il conto - o l'ospite stesso dal telefono, o il personale dall'Admin Hub.",
				"Il tavolo diventa rosso, il 💳 appare alla cassa.",
				"La cassa controlla l'ordine, incassa, preme «Chiudi tavolo» - il tavolo torna subito libero, lo stesso codice QR resta valido per il prossimo ospite."
			],
			guide: {
				waiter: [
					"Tutti i tavoli sono mostrati come riquadri: verde = libero, arancione = attivo, rosso = conto richiesto.",
					"Nuovi ospiti a un tavolo libero (verde)? Tocca il riquadro per vedere un popup con «Attiva» - solo quel pulsante apre davvero il tavolo.",
					"Tocca un riquadro attivo per vedere l'ordine e aggiungere articoli.",
					"🛎️ sul riquadro = qualcosa è pronto e aspetta di essere ritirato.",
					"L'ospite vuole pagare ma non l'ha detto dal telefono? Tocca «Richiedi conto» nel popup - il riquadro diventa rosso e la cassa lo vede subito.",
					"Il pagamento avviene alla cassa - è lì che il tavolo viene liberato di nuovo. Solo un tavolo attivato per errore e ancora vuoto può essere liberato direttamente qui, con «Libera di nuovo il tavolo»."
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
					"«Chiudi tavolo» = l’ospite ha pagato, il tavolo torna libero.",
					"📊 Riepilogo = il totale di tutti i tavoli attualmente aperti."
				]
			},
		offline: 'Nessuna connessione a Internet. La pagina si ricarica automaticamente quando torni online.',
		linkIncomplete: 'Questo link è incompleto.', linkInvalid: 'Questo link non è più valido.', actionFailed: 'Azione non riuscita.',
		onboardingHeading: 'Smart ServiceHub™ – dati di accesso per {name}', staffHeading: 'Accesso per il personale'
	},
	es: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cocina', bar: 'Bar', cashier: 'Caja' },
		live: 'En vivo', empty: 'No hay mesas activas ahora mismo.', hubEmptyOrder: 'Todavía sin pedido.', table: 'Mesa',
		hubStatus: { FREE: 'Libre', ACTIVE: 'Activa', PAYMENT_PENDING: 'Ocupada' },
		allDone: 'Todo listo', addItem: '+ Artículo', add: 'Añadir',
		requestBill: '💳 Pedir la cuenta', billRequested: '💳 Cuenta solicitada', billFlagHint: 'Cuenta pedida - cierra la mesa',
		notesPlaceholder: 'Nota (opcional)', closeTable: 'Cerrar mesa', deactivateTable: 'Liberar la mesa de nuevo', activateTable: 'Activar',
		closeConfirm: '¿Cerrar esta mesa de verdad? El pedido desaparecerá de todas las vistas.',
			removeItem: 'Eliminar artículo', removeConfirm: '¿Eliminar {item} de verdad?',
			guideButton: 'Guía', guideTitle: 'Cómo funciona',
			totalsButton: '📊 Resumen', totalsHeading: 'Total de todas las mesas abiertas',
			workflowButton: 'Flujo', workflowTitle: 'Cómo funciona todo el proceso',
			workflow: [
				"Los clientes escanean el código QR de la mesa - el menú se abre, pero solo se puede pedir después de la activación.",
				"Toca la mesa libre (verde) en el Admin Hub y pulsa «Activar».",
				"A partir de ahí, cada cliente pide desde su propio móvil - todos los pedidos llegan juntos a la misma mesa.",
				"Los artículos se reparten automáticamente entre cocina y bar, según lo que se haya pedido.",
				"Cocina y bar ven sus artículos como una lista y los marcan como listos.",
				"Los clientes ven en tiempo real en su móvil qué está listo, con precio y total.",
				"Los clientes pueden volver a pedir en cualquier momento sin escanear el menú de nuevo.",
				"Pedir la cuenta - ya sea el propio cliente desde el móvil, o el personal desde el Admin Hub.",
				"La mesa se pone roja, el 💳 aparece en caja.",
				"Caja revisa el pedido, cobra, pulsa «Cerrar mesa» - la mesa queda libre al instante, el mismo código QR sigue siendo válido para el próximo cliente."
			],
			guide: {
				waiter: [
					"Todas las mesas se muestran como fichas: verde = libre, naranja = activa, rojo = cuenta solicitada.",
					"¿Nuevos clientes en una mesa libre (verde)? Toca la ficha para ver un popup con «Activar» - solo ese botón abre de verdad la mesa.",
					"Toca una ficha activa para ver el pedido y añadir artículos.",
					"🛎️ en la ficha = algo está listo y espera a que lo recojas.",
					"¿El cliente quiere pagar pero no lo dijo desde su móvil? Pulsa «Pedir la cuenta» en el popup - la ficha se pone roja y caja lo ve al instante.",
					"El pago se hace en caja - ahí es también donde se libera la mesa de nuevo. Solo una mesa activada por error y que sigue vacía se puede liberar aquí mismo, con «Liberar la mesa de nuevo»."
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
					"«Cerrar mesa» = el cliente ha pagado, la mesa queda libre.",
					"📊 Resumen = el total de todas las mesas abiertas ahora mismo."
				]
			},
		offline: 'Sin conexión a Internet. La página se recargará automáticamente cuando vuelvas a estar en línea.',
		linkIncomplete: 'Este enlace está incompleto.', linkInvalid: 'Este enlace ya no es válido.', actionFailed: 'La acción falló.',
		onboardingHeading: 'Smart ServiceHub™ – datos de acceso para {name}', staffHeading: 'Acceso del personal'
	},
	fr: {
		roleLabels: { waiter: 'Admin Hub', kitchen: 'Cuisine', bar: 'Bar', cashier: 'Caisse' },
		live: 'En direct', empty: 'Aucune table active pour le moment.', hubEmptyOrder: 'Pas encore de commande.', table: 'Table',
		hubStatus: { FREE: 'Libre', ACTIVE: 'Active', PAYMENT_PENDING: 'Occupée' },
		allDone: 'Tout est prêt', addItem: '+ Article', add: 'Ajouter',
		requestBill: '💳 Demander l’addition', billRequested: '💳 Addition demandée', billFlagHint: 'Addition demandée - fermez la table',
		notesPlaceholder: 'Remarque (optionnel)', closeTable: 'Fermer la table', deactivateTable: 'Libérer à nouveau la table', activateTable: 'Activer',
		closeConfirm: 'Vraiment fermer cette table ? La commande disparaîtra de toutes les vues.',
			removeItem: "Supprimer l'article", removeConfirm: 'Vraiment supprimer {item} ?',
			guideButton: 'Guide', guideTitle: 'Comment ça marche',
			totalsButton: '📊 Vue d’ensemble', totalsHeading: 'Total de toutes les tables ouvertes',
			workflowButton: 'Déroulement', workflowTitle: 'Comment fonctionne tout le processus',
			workflow: [
				"Les clients scannent le QR code de la table - le menu s'ouvre, mais on ne peut commander qu'après l'activation.",
				"Touchez la table libre (verte) dans l'Admin Hub et appuyez sur « Activer ».",
				"À partir de là, chaque client commande depuis son propre téléphone - toutes les commandes arrivent ensemble sur la même table.",
				"Les articles sont répartis automatiquement entre la cuisine et le bar, selon ce qui a été commandé.",
				"La cuisine et le bar voient leurs articles sous forme de liste et les marquent comme prêts.",
				"Les clients voient en direct sur leur téléphone ce qui est prêt, avec le prix et le total.",
				"Les clients peuvent recommander à tout moment sans rescanner le menu.",
				"Demander l'addition - soit le client lui-même depuis son téléphone, soit le personnel depuis l'Admin Hub.",
				"La table devient rouge, le 💳 apparaît à la caisse.",
				"La caisse vérifie la commande, encaisse, appuie sur « Fermer la table » - la table est libérée immédiatement, le même QR code reste valable pour le prochain client."
			],
			guide: {
				waiter: [
					"Toutes les tables sont affichées en tuiles : vert = libre, orange = active, rouge = addition demandée.",
					"Nouveaux clients à une table libre (verte) ? Touchez la tuile pour voir une fenêtre avec « Activer » - seul ce bouton ouvre vraiment la table.",
					"Touchez une tuile active pour voir la commande et ajouter des articles.",
					"🛎️ sur une tuile = quelque chose est prêt et attend d'être récupéré.",
					"Le client veut payer mais ne l'a pas dit via son téléphone ? Appuyez sur « Demander l'addition » dans la fenêtre - la tuile devient rouge et la caisse le voit tout de suite.",
					"Le paiement se fait à la caisse - c'est aussi là que la table est libérée à nouveau. Seule une table activée par erreur et encore vide peut être libérée ici, via « Libérer à nouveau la table »."
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
					"« Fermer la table » = le client a payé, la table est de nouveau libre.",
					"📊 Vue d'ensemble = le total de toutes les tables actuellement ouvertes."
				]
			},
		offline: 'Pas de connexion Internet. La page se recharge automatiquement dès que vous êtes de nouveau en ligne.',
		linkIncomplete: 'Ce lien est incomplet.', linkInvalid: "Ce lien n'est plus valide.", actionFailed: "L'action a échoué.",
		onboardingHeading: 'Smart ServiceHub™ – informations d’accès pour {name}', staffHeading: 'Accès du personnel'
	}
};
