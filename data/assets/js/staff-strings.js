// UI chrome strings for waiter/kitchen/bar/cashier - same 6-language set as
// quiz-strings.js (Smart Food Match), since that's what the guest menu
// already offers and staff.js's language switcher mirrors it. Dish names
// themselves are never translated here - they come from the menu's own
// source-language text, same as an order ticket in any real restaurant.
// "Service Hub" (the former "Kellner" role) keeps its name untranslated in
// every language - see 0017_table_hub.sql / staff.js for what it does.
window.STAFF_STRINGS = {
	de: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Küche', bar: 'Bar', cashier: 'Kasse' },
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
				"Im Service Hub auf den freien (grünen) Tisch tippen und „Aktivieren“ drücken.",
				"Ab jetzt bestellt jeder Gast über sein eigenes Handy - alle Bestellungen landen zusammen am selben Tisch.",
				"Artikel werden automatisch an Küche oder Bar verteilt, je nachdem was bestellt wurde.",
				"Küche und Bar sehen ihre Artikel als Liste und markieren sie als fertig.",
				"Gäste sehen live auf ihrem Handy, was schon fertig ist, inklusive Preis und Summe.",
				"Gäste können jederzeit nachbestellen, ohne das Menü neu zu scannen.",
				"Rechnung anfordern - entweder der Gast selbst am Handy oder das Personal im Service Hub.",
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
					"Bezahlt wird an der Kasse – dort wird der Tisch danach wieder freigegeben. Nur ein aus Versehen aktivierter, noch leerer Tisch lässt sich direkt hier über „Tisch wieder freigeben“ zurücksetzen.",
					"Gast bestellt mündlich statt über den QR-Code (z. B. „Noch ein Wasser, bitte“)? Kachel antippen → „+ Artikel“ → Artikel und Menge wählen → „Hinzufügen“. Der Artikel geht automatisch an Küche oder Bar und steht auf der Rechnung des Tisches.",
					"Bei jeder neuen 🛎️ ertönt ein Klingelton. Ein- und ausschalten unten links mit „Klingelton“. Tipp: Nach dem Öffnen der Seite einmal auf den Bildschirm tippen – erst dann erlaubt der Browser Töne."
				],
				kitchen: [
					"Hier siehst du, was die Gäste bestellt haben.",
					"Rot = noch zu machen. Tippe auf die Zeile, wenn es fertig ist. Dann wird sie grün.",
					"„Alles fertig“ = alles für diesen Tisch ist fertig.",
					"Neue Bestellungen kommen von selbst – mit Klingelton, und die Karte blinkt kurz orange. Ein- und ausschalten unten links mit „Klingelton“. Tipp: Nach dem Öffnen der Seite einmal auf den Bildschirm tippen – erst dann erlaubt der Browser Töne."
				],
				bar: [
					"Hier siehst du, welche Getränke bestellt wurden.",
					"Rot = noch zu machen. Tippe auf die Zeile, wenn es fertig ist. Dann wird sie grün.",
					"„Alles fertig“ = alle Getränke für diesen Tisch sind fertig.",
					"Neue Bestellungen kommen von selbst – mit Klingelton, und die Karte blinkt kurz orange. Ein- und ausschalten unten links mit „Klingelton“. Tipp: Nach dem Öffnen der Seite einmal auf den Bildschirm tippen – erst dann erlaubt der Browser Töne.",
					"Gast bestellt direkt bei dir statt über den QR-Code? Beispiel: Er sitzt an der Bar, hat seine erste Bestellung per QR-Code gemacht und sagt dann „Bitte noch ein Bier und einen Orangensaft“. Bei seinem Tisch „+ Artikel“ drücken → Getränk und Menge wählen → „Hinzufügen“. Es steht sofort auf seiner Rechnung; bestellt er Essen, geht das automatisch an die Küche.",
					"„+ Artikel“ gibt es nur bei Tischen, die hier schon eine Karte haben. Für einen anderen Tisch den Artikel im Service Hub hinzufügen."
				],
				cashier: [
					"Hier siehst du alle Tische mit Preisen und Summe.",
					"💳 Der Gast möchte zahlen.",
					"✕ = Position löschen (du wirst vorher gefragt).",
					"„Tisch schließen“ = der Gast hat bezahlt, der Tisch ist wieder frei.",
					"📊 Gesamtübersicht = Summe über alle gerade offenen Tische.",
					"Gast bestellt beim Bezahlen noch etwas dazu (z. B. „Noch einen Espresso, bitte“)? Bei seinem Tisch „+ Artikel“ → Artikel und Menge wählen → „Hinzufügen“. Er steht sofort auf der Rechnung und geht automatisch an Küche oder Bar.",
					"Fordert ein Tisch die Rechnung an (💳), ertönt ein Klingelton und die Karte blinkt kurz rot. Ein- und ausschalten unten links mit „Klingelton“. Tipp: Nach dem Öffnen der Seite einmal auf den Bildschirm tippen – erst dann erlaubt der Browser Töne."
				]
			},
		workflowSteps: ["Gäste scannen den QR-Code", "Tisch aktivieren", "Alle bestellen", "Automatische Verteilung", "Küche & Bar arbeiten", "Gäste sehen den Status live", "Jederzeit nachbestellen", "Rechnung anfordern", "Tisch wird rot", "Tisch schließen"],
		noTables: 'Noch keine Tische angelegt.', floorTitle: 'Tischplan', ordersTitle: 'Bestellungen',
		activityTitle: 'Live-Aktivität', viewAll: 'Alle ansehen', statusTitle: 'Stations-Status', summaryTitle: 'Bestell-Übersicht', today: 'Heute',
		qrOrders: 'Über QR-Code', staffOrders: 'Vom Personal', orderValue: 'Bestellwert heute', itemsLabel: 'Artikel',
		statusOpen: '{n} offen', statusActiveTables: '{n} aktive Tische', statusBills: '{n} Rechnungen',
		evOpened: 'Tisch aktiviert', evOrderGuest: 'Gast bestellt: {items}', evOrderStaff: '{who} hat hinzugefügt: {items}',
		evReadyKitchen: 'Küche: {n} Artikel fertig', evReadyBar: 'Bar: {n} Artikel fertig', evBill: 'Rechnung angefordert', evClosed: 'Bezahlt & geschlossen',
		timeJustNow: 'gerade eben', timeMinutes: 'vor {n} Min.', timeHours: 'vor {n} Std.', noActivity: 'Heute noch keine Aktivität.',
		historyTitle: 'Verlauf heute', noOpenOrders: 'Gerade keine offenen Bestellungen.',
		tileOpenOrders: 'Offene Bestellungen', tileOpenOrdersSub: 'Alle aktiven Tische auf einen Blick', tileHistorySub: 'Alles, was heute passiert ist',
		tileTotals: 'Gesamtübersicht', tileTotalsSub: 'Summe aller offenen Tische', tileHelp: 'So funktioniert’s', tileHelpSub: 'Der Ablauf in 10 Schritten',
		chimeOn: 'Klingelton an', chimeOff: 'Klingelton aus',
		privacyLink: 'Datenschutz', imprintLink: 'Impressum',
		offline: 'Keine Internetverbindung. Die Seite lädt automatisch neu, sobald du wieder online bist.',
		linkIncomplete: 'Dieser Link ist unvollständig.', linkInvalid: 'Dieser Link ist nicht mehr gültig.', actionFailed: 'Aktion fehlgeschlagen.',
		tablesEmailLinkText: 'Link zum Tisch', tablesEmailHeading: 'Tisch-QR-Codes für {name}', tablesEmailHint: 'Jeder QR-Code gehört zu genau einem Tisch – bitte ausdrucken und auf den passenden Tisch stellen. Gäste scannen ihn und können bestellen, sobald der Tisch im Service Hub aktiviert ist.',
		onboardingHeading: 'Smart ServiceHub™ – Zugangsdaten für {name}', staffHeading: 'Personal-Zugänge'
	},
	en: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Kitchen', bar: 'Bar', cashier: 'Cashier' },
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
				"Tap the free (green) table in the Service Hub and press \"Activate\".",
				"From then on, every guest orders from their own phone - all orders land together on the same table.",
				"Items are automatically split between kitchen and bar, based on what was ordered.",
				"Kitchen and bar see their items as a list and mark them done.",
				"Guests see live on their phone what's ready, including price and total.",
				"Guests can reorder any time without scanning the menu again.",
				"Request the bill - either the guest themselves on their phone, or staff in the Service Hub.",
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
					"Payment happens at the cashier - that's also where the table gets freed again. Only a table you activated by mistake and that's still empty can be freed right here, via \"Free this table again\".",
					"Guest orders by telling you instead of using the QR code (e.g. “Another water, please”)? Tap the tile → “+ Item” → choose item and quantity → “Add”. It goes to the kitchen or bar automatically and is added to the table’s bill.",
					"Every new 🛎️ plays a chime. Turn it on or off at the bottom left with “Chime”. Tip: tap the screen once after opening the page – only then does the browser allow sounds."
				],
				kitchen: [
					"Here you see what the guests ordered.",
					"Red = still to make. Tap the row when it is ready. Then it turns green.",
					"“All done” = everything for this table is ready.",
					"New orders arrive by themselves – with a chime, and the card briefly flashes orange. Turn it on or off at the bottom left with “Chime”. Tip: tap the screen once after opening the page – only then does the browser allow sounds."
				],
				bar: [
					"Here you see which drinks were ordered.",
					"Red = still to make. Tap the row when it is ready. Then it turns green.",
					"“All done” = all drinks for this table are ready.",
					"New orders arrive by themselves – with a chime, and the card briefly flashes orange. Turn it on or off at the bottom left with “Chime”. Tip: tap the screen once after opening the page – only then does the browser allow sounds.",
					"Guest orders directly from you instead of using the QR code? Example: they sit at the bar, placed their first order with the QR code and then say “One more beer and an orange juice, please”. Press “+ Item” on their table → choose drink and quantity → “Add”. It’s on their bill right away; food they order goes to the kitchen automatically.",
					"“+ Item” is only available for tables that already have a card here. For any other table, add the item in the Service Hub."
				],
				cashier: [
					"All tables with prices and the total are shown here.",
					"💳 The guest wants to pay.",
					"✕ = delete an item (you will be asked first).",
					"“Close table” = the guest has paid, the table is free again.",
					"📊 Overview = the total across every table that's currently open.",
					"Guest orders something else while paying (e.g. “One more espresso, please”)? Press “+ Item” on their table → choose item and quantity → “Add”. It’s on the bill right away and goes to the kitchen or bar automatically.",
					"When a table asks for the bill (💳), a chime plays and the card briefly flashes red. Turn it on or off at the bottom left with “Chime”. Tip: tap the screen once after opening the page – only then does the browser allow sounds."
				]
			},
		workflowSteps: ["Guests scan the QR code", "Activate the table", "Everyone orders", "Auto distribution", "Kitchen & bar process", "Guests see live status", "Reorder anytime", "Request the bill", "Table turns red", "Close the table"],
		noTables: 'No tables set up yet.', floorTitle: 'Restaurant Floor', ordersTitle: 'Orders',
		activityTitle: 'Live Activity', viewAll: 'View all', statusTitle: 'Service Status', summaryTitle: 'Order Summary', today: 'Today',
		qrOrders: 'Via QR code', staffOrders: 'By staff', orderValue: 'Order value today', itemsLabel: 'items',
		statusOpen: '{n} open', statusActiveTables: '{n} active tables', statusBills: '{n} bills',
		evOpened: 'Table activated', evOrderGuest: 'Guest ordered: {items}', evOrderStaff: '{who} added: {items}',
		evReadyKitchen: 'Kitchen: {n} ready', evReadyBar: 'Bar: {n} ready', evBill: 'Bill requested', evClosed: 'Paid & closed',
		timeJustNow: 'just now', timeMinutes: '{n} min ago', timeHours: '{n} h ago', noActivity: 'No activity yet today.',
		historyTitle: "Today's history", noOpenOrders: 'No open orders right now.',
		tileOpenOrders: 'Open orders', tileOpenOrdersSub: 'All active tables at a glance', tileHistorySub: 'Everything that happened today',
		tileTotals: 'Overview', tileTotalsSub: 'Total of all open tables', tileHelp: 'How it works', tileHelpSub: 'The workflow in 10 steps',
		chimeOn: 'Chime on', chimeOff: 'Chime off',
		privacyLink: 'Privacy', imprintLink: 'Legal notice',
		offline: 'No internet connection. This page reloads automatically once you are back online.',
		linkIncomplete: 'This link is incomplete.', linkInvalid: 'This link is no longer valid.', actionFailed: 'Action failed.',
		tablesEmailLinkText: 'Table link', tablesEmailHeading: 'Table QR codes for {name}', tablesEmailHint: 'Each QR code belongs to exactly one table – please print it and place it on the matching table. Guests scan it and can order as soon as the table is activated in the Service Hub.',
		onboardingHeading: 'Smart ServiceHub™ – access details for {name}', staffHeading: 'Staff access'
	},
	el: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Κουζίνα', bar: 'Μπαρ', cashier: 'Ταμείο' },
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
				"Πάτα το ελεύθερο (πράσινο) τραπέζι στο Service Hub και πάτα «Ενεργοποίηση».",
				"Από εκεί και πέρα κάθε πελάτης παραγγέλνει από το δικό του κινητό - όλες οι παραγγελίες πάνε μαζί στο ίδιο τραπέζι.",
				"Τα προϊόντα μοιράζονται αυτόματα σε κουζίνα ή μπαρ, ανάλογα με το τι παραγγέλθηκε.",
				"Κουζίνα και μπαρ βλέπουν τα προϊόντα τους ως λίστα και τα σημειώνουν έτοιμα.",
				"Οι πελάτες βλέπουν ζωντανά στο κινητό τους τι είναι έτοιμο, με τιμή και σύνολο.",
				"Οι πελάτες μπορούν να ξαναπαραγγείλουν ανά πάσα στιγμή, χωρίς να σκανάρουν ξανά το μενού.",
				"Ζήτα τον λογαριασμό - είτε ο ίδιος ο πελάτης από το κινητό, είτε το προσωπικό από το Service Hub.",
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
					"Η πληρωμή γίνεται στο ταμείο - εκεί ελευθερώνεται το τραπέζι ξανά. Μόνο ένα τραπέζι που ενεργοποιήθηκε κατά λάθος και είναι ακόμα άδειο μπορεί να ελευθερωθεί εδώ, με «Ελευθέρωσε ξανά το τραπέζι».",
					"Ο πελάτης παραγγέλνει προφορικά αντί για το QR code (π.χ. «Άλλο ένα νερό, παρακαλώ»); Πατήστε το πλακίδιο → «+ Προσθήκη» → επιλέξτε είδος και ποσότητα → «Προσθήκη». Πηγαίνει αυτόματα στην κουζίνα ή στο μπαρ και μπαίνει στον λογαριασμό του τραπεζιού.",
					"Με κάθε νέο 🛎️ ακούγεται ένα κουδούνισμα. Ενεργοποίηση/απενεργοποίηση κάτω αριστερά με «Κουδούνισμα». Συμβουλή: μετά το άνοιγμα της σελίδας πατήστε μία φορά στην οθόνη – μόνο τότε ο browser επιτρέπει ήχους."
				],
				kitchen: [
					"Εδώ βλέπεις τι παρήγγειλαν οι πελάτες.",
					"Κόκκινο = ακόμα να γίνει. Πάτα τη γραμμή όταν είναι έτοιμο. Τότε γίνεται πράσινη.",
					"«Όλα έτοιμα» = όλα για αυτό το τραπέζι είναι έτοιμα.",
					"Οι νέες παραγγελίες έρχονται μόνες τους – με κουδούνισμα, και η κάρτα αναβοσβήνει για λίγο πορτοκαλί. Ενεργοποίηση/απενεργοποίηση κάτω αριστερά με «Κουδούνισμα». Συμβουλή: μετά το άνοιγμα της σελίδας πάτησε μία φορά στην οθόνη – μόνο τότε ο browser επιτρέπει ήχους."
				],
				bar: [
					"Εδώ βλέπεις ποια ποτά παραγγέλθηκαν.",
					"Κόκκινο = ακόμα να γίνει. Πάτα τη γραμμή όταν είναι έτοιμο. Τότε γίνεται πράσινη.",
					"«Όλα έτοιμα» = όλα τα ποτά για αυτό το τραπέζι είναι έτοιμα.",
					"Οι νέες παραγγελίες έρχονται μόνες τους – με κουδούνισμα, και η κάρτα αναβοσβήνει για λίγο πορτοκαλί. Ενεργοποίηση/απενεργοποίηση κάτω αριστερά με «Κουδούνισμα». Συμβουλή: μετά το άνοιγμα της σελίδας πάτησε μία φορά στην οθόνη – μόνο τότε ο browser επιτρέπει ήχους.",
					"Ο πελάτης παραγγέλνει απευθείας σε εσάς αντί για το QR code; Παράδειγμα: κάθεται στο μπαρ, έκανε την πρώτη του παραγγελία με το QR code και μετά λέει «Άλλη μία μπίρα και έναν χυμό πορτοκάλι, παρακαλώ». Πατήστε «+ Προσθήκη» στο τραπέζι του → επιλέξτε ποτό και ποσότητα → «Προσθήκη». Μπαίνει αμέσως στον λογαριασμό του· αν παραγγείλει φαγητό, πηγαίνει αυτόματα στην κουζίνα.",
					"Το «+ Προσθήκη» υπάρχει μόνο για τραπέζια που έχουν ήδη κάρτα εδώ. Για άλλο τραπέζι, προσθέστε το είδος στο Service Hub."
				],
				cashier: [
					"Εδώ βλέπεις όλα τα τραπέζια με τιμές και σύνολο.",
					"💳 Ο πελάτης θέλει να πληρώσει.",
					"✕ = διαγραφή προϊόντος (θα σε ρωτήσει πρώτα).",
					"«Κλείσιμο τραπεζιού» = ο πελάτης πλήρωσε, το τραπέζι είναι ξανά ελεύθερο.",
					"📊 Σύνολο = το άθροισμα όλων των τραπεζιών που είναι αυτή τη στιγμή ανοιχτά.",
					"Ο πελάτης παραγγέλνει κάτι ακόμα την ώρα που πληρώνει (π.χ. «Έναν ακόμα espresso, παρακαλώ»); Πατήστε «+ Προσθήκη» στο τραπέζι του → επιλέξτε είδος και ποσότητα → «Προσθήκη». Μπαίνει αμέσως στον λογαριασμό και πηγαίνει αυτόματα στην κουζίνα ή στο μπαρ.",
					"Όταν ένα τραπέζι ζητήσει λογαριασμό (💳), ακούγεται ένα κουδούνισμα και η κάρτα αναβοσβήνει για λίγο κόκκινη. Ενεργοποίηση/απενεργοποίηση κάτω αριστερά με «Κουδούνισμα». Συμβουλή: μετά το άνοιγμα της σελίδας πατήστε μία φορά στην οθόνη – μόνο τότε ο browser επιτρέπει ήχους."
				]
			},
		workflowSteps: ["Οι πελάτες σκανάρουν το QR code", "Ενεργοποίηση τραπεζιού", "Όλοι παραγγέλνουν", "Αυτόματη διανομή", "Κουζίνα & μπαρ ετοιμάζουν", "Οι πελάτες βλέπουν ζωντανά την κατάσταση", "Νέα παραγγελία ανά πάσα στιγμή", "Αίτημα λογαριασμού", "Το τραπέζι γίνεται κόκκινο", "Κλείσιμο τραπεζιού"],
		noTables: 'Δεν έχουν οριστεί τραπέζια ακόμα.', floorTitle: 'Κάτοψη τραπεζιών', ordersTitle: 'Παραγγελίες',
		activityTitle: 'Ζωντανή δραστηριότητα', viewAll: 'Προβολή όλων', statusTitle: 'Κατάσταση σταθμών', summaryTitle: 'Σύνοψη παραγγελιών', today: 'Σήμερα',
		qrOrders: 'Μέσω QR code', staffOrders: 'Από το προσωπικό', orderValue: 'Αξία παραγγελιών σήμερα', itemsLabel: 'είδη',
		statusOpen: '{n} ανοιχτά', statusActiveTables: '{n} ενεργά τραπέζια', statusBills: '{n} λογαριασμοί',
		evOpened: 'Το τραπέζι ενεργοποιήθηκε', evOrderGuest: 'Ο πελάτης παρήγγειλε: {items}', evOrderStaff: '{who} πρόσθεσε: {items}',
		evReadyKitchen: 'Κουζίνα: {n} έτοιμα', evReadyBar: 'Μπαρ: {n} έτοιμα', evBill: 'Ζητήθηκε λογαριασμός', evClosed: 'Πληρώθηκε & έκλεισε',
		timeJustNow: 'μόλις τώρα', timeMinutes: 'πριν {n} λεπ.', timeHours: 'πριν {n} ώρ.', noActivity: 'Καμία δραστηριότητα σήμερα ακόμα.',
		historyTitle: 'Ιστορικό σήμερα', noOpenOrders: 'Δεν υπάρχουν ανοιχτές παραγγελίες αυτή τη στιγμή.',
		tileOpenOrders: 'Ανοιχτές παραγγελίες', tileOpenOrdersSub: 'Όλα τα ενεργά τραπέζια με μια ματιά', tileHistorySub: 'Όλα όσα έγιναν σήμερα',
		tileTotals: 'Συνολική εικόνα', tileTotalsSub: 'Σύνολο όλων των ανοιχτών τραπεζιών', tileHelp: 'Πώς λειτουργεί', tileHelpSub: 'Η διαδικασία σε 10 βήματα',
		chimeOn: 'Κουδούνισμα ενεργό', chimeOff: 'Κουδούνισμα ανενεργό',
		privacyLink: 'Απόρρητο', imprintLink: 'Νομικές πληροφορίες',
		offline: 'Δεν υπάρχει σύνδεση στο διαδίκτυο. Η σελίδα θα ανανεωθεί αυτόματα μόλις συνδεθείτε ξανά.',
		linkIncomplete: 'Αυτός ο σύνδεσμος είναι ελλιπής.', linkInvalid: 'Αυτός ο σύνδεσμος δεν ισχύει πια.', actionFailed: 'Η ενέργεια απέτυχε.',
		tablesEmailLinkText: 'Σύνδεσμος τραπεζιού', tablesEmailHeading: 'QR codes τραπεζιών για {name}', tablesEmailHint: 'Κάθε QR code ανήκει σε ένα μόνο τραπέζι – εκτυπώστε το και τοποθετήστε το στο αντίστοιχο τραπέζι. Οι πελάτες το σκανάρουν και μπορούν να παραγγείλουν μόλις ενεργοποιηθεί το τραπέζι στο Service Hub.',
		onboardingHeading: 'Smart ServiceHub™ – στοιχεία πρόσβασης για {name}', staffHeading: 'Πρόσβαση προσωπικού'
	},
	it: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' },
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
				"Tocca il tavolo libero (verde) nell'Service Hub e premi «Attiva».",
				"Da quel momento ogni ospite ordina dal proprio telefono - tutti gli ordini finiscono insieme sullo stesso tavolo.",
				"Gli articoli vengono divisi automaticamente tra cucina e bar, in base a cosa è stato ordinato.",
				"Cucina e bar vedono i propri articoli come una lista e li segnano come pronti.",
				"Gli ospiti vedono in tempo reale sul telefono cosa è pronto, incluso prezzo e totale.",
				"Gli ospiti possono riordinare in qualsiasi momento senza scansionare di nuovo il menu.",
				"Richiedi il conto - o l'ospite stesso dal telefono, o il personale dall'Service Hub.",
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
					"Il pagamento avviene alla cassa - è lì che il tavolo viene liberato di nuovo. Solo un tavolo attivato per errore e ancora vuoto può essere liberato direttamente qui, con «Libera di nuovo il tavolo».",
					"L’ospite ordina a voce invece che con il QR code (es. «Un’altra acqua, per favore»)? Tocca la tessera → «+ Articolo» → scegli articolo e quantità → «Aggiungi». Va automaticamente in cucina o al bar e viene aggiunto al conto del tavolo.",
					"A ogni nuova 🛎️ suona un campanello. Attivalo o disattivalo in basso a sinistra con «Campanello». Consiglio: dopo aver aperto la pagina tocca una volta lo schermo – solo allora il browser permette i suoni."
				],
				kitchen: [
					"Qui vedi cosa hanno ordinato gli ospiti.",
					"Rosso = ancora da fare. Tocca la riga quando è pronto. Poi diventa verde.",
					"«Tutto pronto» = tutto per questo tavolo è pronto.",
					"Le nuove ordinazioni arrivano da sole – con un campanello, e la scheda lampeggia brevemente in arancione. Attivalo o disattivalo in basso a sinistra con «Campanello». Suggerimento: dopo aver aperto la pagina tocca una volta lo schermo – solo allora il browser consente i suoni."
				],
				bar: [
					"Qui vedi quali bevande sono state ordinate.",
					"Rosso = ancora da fare. Tocca la riga quando è pronto. Poi diventa verde.",
					"«Tutto pronto» = tutte le bevande di questo tavolo sono pronte.",
					"Le nuove ordinazioni arrivano da sole – con un campanello, e la scheda lampeggia brevemente in arancione. Attivalo o disattivalo in basso a sinistra con «Campanello». Suggerimento: dopo aver aperto la pagina tocca una volta lo schermo – solo allora il browser consente i suoni.",
					"L’ospite ordina direttamente a te invece che con il QR code? Esempio: è seduto al bar, ha fatto il primo ordine con il QR code e poi dice «Ancora una birra e un succo d’arancia, per favore». Premi «+ Articolo» sul suo tavolo → scegli bevanda e quantità → «Aggiungi». È subito sul suo conto; il cibo che ordina va automaticamente in cucina.",
					"«+ Articolo» è disponibile solo per i tavoli che hanno già una scheda qui. Per un altro tavolo aggiungi l’articolo nel Service Hub."
				],
				cashier: [
					"Qui vedi tutti i tavoli con prezzi e totale.",
					"💳 L’ospite vuole pagare.",
					"✕ = elimina un articolo (prima ti viene chiesto).",
					"«Chiudi tavolo» = l’ospite ha pagato, il tavolo torna libero.",
					"📊 Riepilogo = il totale di tutti i tavoli attualmente aperti.",
					"L’ospite ordina ancora qualcosa mentre paga (es. «Un altro espresso, per favore»)? Premi «+ Articolo» sul suo tavolo → scegli articolo e quantità → «Aggiungi». È subito sul conto e va automaticamente in cucina o al bar.",
					"Quando un tavolo chiede il conto (💳), suona un campanello e la scheda lampeggia brevemente di rosso. Attivalo o disattivalo in basso a sinistra con «Campanello». Consiglio: dopo aver aperto la pagina tocca una volta lo schermo – solo allora il browser permette i suoni."
				]
			},
		workflowSteps: ["Gli ospiti scansionano il QR code", "Attivare il tavolo", "Tutti ordinano", "Distribuzione automatica", "Cucina e bar preparano", "Gli ospiti vedono lo stato in tempo reale", "Riordinare in qualsiasi momento", "Richiedere il conto", "Il tavolo diventa rosso", "Chiudere il tavolo"],
		noTables: 'Nessun tavolo configurato.', floorTitle: 'Sala', ordersTitle: 'Ordini',
		activityTitle: 'Attività in tempo reale', viewAll: 'Vedi tutto', statusTitle: 'Stato delle postazioni', summaryTitle: 'Riepilogo ordini', today: 'Oggi',
		qrOrders: 'Tramite QR code', staffOrders: 'Dal personale', orderValue: 'Valore ordini oggi', itemsLabel: 'articoli',
		statusOpen: '{n} aperti', statusActiveTables: '{n} tavoli attivi', statusBills: '{n} conti',
		evOpened: 'Tavolo attivato', evOrderGuest: 'Ordine del cliente: {items}', evOrderStaff: '{who} ha aggiunto: {items}',
		evReadyKitchen: 'Cucina: {n} pronti', evReadyBar: 'Bar: {n} pronti', evBill: 'Conto richiesto', evClosed: 'Pagato e chiuso',
		timeJustNow: 'proprio ora', timeMinutes: '{n} min fa', timeHours: '{n} h fa', noActivity: 'Ancora nessuna attività oggi.',
		historyTitle: 'Cronologia di oggi', noOpenOrders: 'Nessun ordine aperto al momento.',
		tileOpenOrders: 'Ordini aperti', tileOpenOrdersSub: 'Tutti i tavoli attivi a colpo d’occhio', tileHistorySub: 'Tutto ciò che è successo oggi',
		tileTotals: 'Panoramica', tileTotalsSub: 'Totale di tutti i tavoli aperti', tileHelp: 'Come funziona', tileHelpSub: 'La procedura in 10 passi',
		chimeOn: 'Campanello attivo', chimeOff: 'Campanello disattivato',
		privacyLink: 'Privacy', imprintLink: 'Note legali',
		offline: 'Nessuna connessione a Internet. La pagina si ricarica automaticamente quando torni online.',
		linkIncomplete: 'Questo link è incompleto.', linkInvalid: 'Questo link non è più valido.', actionFailed: 'Azione non riuscita.',
		tablesEmailLinkText: 'Link del tavolo', tablesEmailHeading: 'QR code dei tavoli per {name}', tablesEmailHint: 'Ogni QR code appartiene a un solo tavolo: stampalo e mettilo sul tavolo corrispondente. Gli ospiti lo scansionano e possono ordinare non appena il tavolo è attivato nel Service Hub.',
		onboardingHeading: 'Smart ServiceHub™ – dati di accesso per {name}', staffHeading: 'Accesso per il personale'
	},
	es: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Cocina', bar: 'Bar', cashier: 'Caja' },
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
				"Toca la mesa libre (verde) en el Service Hub y pulsa «Activar».",
				"A partir de ahí, cada cliente pide desde su propio móvil - todos los pedidos llegan juntos a la misma mesa.",
				"Los artículos se reparten automáticamente entre cocina y bar, según lo que se haya pedido.",
				"Cocina y bar ven sus artículos como una lista y los marcan como listos.",
				"Los clientes ven en tiempo real en su móvil qué está listo, con precio y total.",
				"Los clientes pueden volver a pedir en cualquier momento sin escanear el menú de nuevo.",
				"Pedir la cuenta - ya sea el propio cliente desde el móvil, o el personal desde el Service Hub.",
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
					"El pago se hace en caja - ahí es también donde se libera la mesa de nuevo. Solo una mesa activada por error y que sigue vacía se puede liberar aquí mismo, con «Liberar la mesa de nuevo».",
					"¿El cliente pide de palabra en lugar de usar el código QR (p. ej. «Otra agua, por favor»)? Toca la ficha → «+ Artículo» → elige artículo y cantidad → «Añadir». Va automáticamente a cocina o barra y se añade a la cuenta de la mesa.",
					"Con cada nueva 🛎️ suena un timbre. Actívalo o desactívalo abajo a la izquierda con «Timbre». Consejo: después de abrir la página toca la pantalla una vez; solo entonces el navegador permite sonidos."
				],
				kitchen: [
					"Aquí ves lo que han pedido los clientes.",
					"Rojo = aún por hacer. Pulsa la fila cuando esté listo. Entonces se vuelve verde.",
					"«Todo listo» = todo lo de esta mesa está listo.",
					"Los pedidos nuevos llegan solos – con un timbre, y la tarjeta parpadea brevemente en naranja. Actívalo o desactívalo abajo a la izquierda con «Timbre». Consejo: después de abrir la página, toca la pantalla una vez – solo entonces el navegador permite sonidos."
				],
				bar: [
					"Aquí ves qué bebidas se han pedido.",
					"Rojo = aún por hacer. Pulsa la fila cuando esté listo. Entonces se vuelve verde.",
					"«Todo listo» = todas las bebidas de esta mesa están listas.",
					"Los pedidos nuevos llegan solos – con un timbre, y la tarjeta parpadea brevemente en naranja. Actívalo o desactívalo abajo a la izquierda con «Timbre». Consejo: después de abrir la página, toca la pantalla una vez – solo entonces el navegador permite sonidos.",
					"¿El cliente te pide directamente a ti en lugar de usar el código QR? Ejemplo: está sentado en la barra, hizo su primer pedido con el código QR y luego dice «Otra cerveza y un zumo de naranja, por favor». Pulsa «+ Artículo» en su mesa → elige bebida y cantidad → «Añadir». Queda al instante en su cuenta; la comida que pida va automáticamente a cocina.",
					"«+ Artículo» solo está disponible para mesas que ya tienen una tarjeta aquí. Para otra mesa, añade el artículo en el Service Hub."
				],
				cashier: [
					"Aquí ves todas las mesas con precios y total.",
					"💳 El cliente quiere pagar.",
					"✕ = borrar un artículo (antes te preguntará).",
					"«Cerrar mesa» = el cliente ha pagado, la mesa queda libre.",
					"📊 Resumen = el total de todas las mesas abiertas ahora mismo.",
					"¿El cliente pide algo más al pagar (p. ej. «Otro espresso, por favor»)? Pulsa «+ Artículo» en su mesa → elige artículo y cantidad → «Añadir». Queda al instante en la cuenta y va automáticamente a cocina o barra.",
					"Cuando una mesa pide la cuenta (💳), suena un timbre y la tarjeta parpadea en rojo unos segundos. Actívalo o desactívalo abajo a la izquierda con «Timbre». Consejo: después de abrir la página toca la pantalla una vez; solo entonces el navegador permite sonidos."
				]
			},
		workflowSteps: ["Los clientes escanean el código QR", "Activar la mesa", "Todos piden", "Distribución automática", "Cocina y bar preparan", "Los clientes ven el estado en vivo", "Volver a pedir en cualquier momento", "Pedir la cuenta", "La mesa se pone roja", "Cerrar la mesa"],
		noTables: 'Todavía no hay mesas.', floorTitle: 'Plano de mesas', ordersTitle: 'Pedidos',
		activityTitle: 'Actividad en vivo', viewAll: 'Ver todo', statusTitle: 'Estado de las estaciones', summaryTitle: 'Resumen de pedidos', today: 'Hoy',
		qrOrders: 'Por código QR', staffOrders: 'Por el personal', orderValue: 'Valor de pedidos hoy', itemsLabel: 'artículos',
		statusOpen: '{n} pendientes', statusActiveTables: '{n} mesas activas', statusBills: '{n} cuentas',
		evOpened: 'Mesa activada', evOrderGuest: 'El cliente pidió: {items}', evOrderStaff: '{who} añadió: {items}',
		evReadyKitchen: 'Cocina: {n} listos', evReadyBar: 'Bar: {n} listos', evBill: 'Cuenta solicitada', evClosed: 'Pagada y cerrada',
		timeJustNow: 'ahora mismo', timeMinutes: 'hace {n} min', timeHours: 'hace {n} h', noActivity: 'Todavía no hay actividad hoy.',
		historyTitle: 'Historial de hoy', noOpenOrders: 'No hay pedidos abiertos ahora.',
		tileOpenOrders: 'Pedidos abiertos', tileOpenOrdersSub: 'Todas las mesas activas de un vistazo', tileHistorySub: 'Todo lo que pasó hoy',
		tileTotals: 'Resumen general', tileTotalsSub: 'Total de todas las mesas abiertas', tileHelp: 'Cómo funciona', tileHelpSub: 'El proceso en 10 pasos',
		chimeOn: 'Timbre activado', chimeOff: 'Timbre desactivado',
		privacyLink: 'Privacidad', imprintLink: 'Aviso legal',
		offline: 'Sin conexión a Internet. La página se recargará automáticamente cuando vuelvas a estar en línea.',
		linkIncomplete: 'Este enlace está incompleto.', linkInvalid: 'Este enlace ya no es válido.', actionFailed: 'La acción falló.',
		tablesEmailLinkText: 'Enlace de la mesa', tablesEmailHeading: 'Códigos QR de las mesas para {name}', tablesEmailHint: 'Cada código QR pertenece a una sola mesa: imprímelo y colócalo en la mesa correspondiente. Los clientes lo escanean y pueden pedir en cuanto la mesa se active en el Service Hub.',
		onboardingHeading: 'Smart ServiceHub™ – datos de acceso para {name}', staffHeading: 'Acceso del personal'
	},
	fr: {
		roleLabels: { waiter: 'Service Hub', kitchen: 'Cuisine', bar: 'Bar', cashier: 'Caisse' },
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
				"Touchez la table libre (verte) dans l'Service Hub et appuyez sur « Activer ».",
				"À partir de là, chaque client commande depuis son propre téléphone - toutes les commandes arrivent ensemble sur la même table.",
				"Les articles sont répartis automatiquement entre la cuisine et le bar, selon ce qui a été commandé.",
				"La cuisine et le bar voient leurs articles sous forme de liste et les marquent comme prêts.",
				"Les clients voient en direct sur leur téléphone ce qui est prêt, avec le prix et le total.",
				"Les clients peuvent recommander à tout moment sans rescanner le menu.",
				"Demander l'addition - soit le client lui-même depuis son téléphone, soit le personnel depuis l'Service Hub.",
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
					"Le paiement se fait à la caisse - c'est aussi là que la table est libérée à nouveau. Seule une table activée par erreur et encore vide peut être libérée ici, via « Libérer à nouveau la table ».",
					"Le client commande à l’oral au lieu d’utiliser le QR code (par ex. « Encore une eau, s’il vous plaît ») ? Touchez la tuile → « + Article » → choisissez l’article et la quantité → « Ajouter ». Il part automatiquement en cuisine ou au bar et s’ajoute à l’addition de la table.",
					"À chaque nouvelle 🛎️, une sonnerie retentit. Activez-la ou désactivez-la en bas à gauche avec « Sonnerie ». Astuce : après avoir ouvert la page, touchez l’écran une fois – le navigateur n’autorise les sons qu’ensuite."
				],
				kitchen: [
					"Vous voyez ici ce que les clients ont commandé.",
					"Rouge = reste à faire. Appuyez sur la ligne quand c’est prêt. Elle devient verte.",
					"« Tout est prêt » = tout est prêt pour cette table.",
					"Les nouvelles commandes arrivent toutes seules – avec une sonnerie, et la carte clignote brièvement en orange. Activez-la ou désactivez-la en bas à gauche avec « Sonnerie ». Astuce : après avoir ouvert la page, touchez l’écran une fois – le navigateur n’autorise les sons qu’ensuite."
				],
				bar: [
					"Vous voyez ici les boissons commandées.",
					"Rouge = reste à faire. Appuyez sur la ligne quand c’est prêt. Elle devient verte.",
					"« Tout est prêt » = toutes les boissons de cette table sont prêtes.",
					"Les nouvelles commandes arrivent toutes seules – avec une sonnerie, et la carte clignote brièvement en orange. Activez-la ou désactivez-la en bas à gauche avec « Sonnerie ». Astuce : après avoir ouvert la page, touchez l’écran une fois – le navigateur n’autorise les sons qu’ensuite.",
					"Le client vous commande directement au lieu d’utiliser le QR code ? Exemple : il est assis au bar, a passé sa première commande avec le QR code, puis dit « Encore une bière et un jus d’orange, s’il vous plaît ». Appuyez sur « + Article » à sa table → choisissez la boisson et la quantité → « Ajouter ». C’est aussitôt sur son addition ; les plats qu’il commande partent automatiquement en cuisine.",
					"« + Article » n’existe que pour les tables qui ont déjà une carte ici. Pour une autre table, ajoutez l’article dans le Service Hub."
				],
				cashier: [
					"Vous voyez ici toutes les tables avec prix et total.",
					"💳 Le client veut payer.",
					"✕ = supprimer un article (une confirmation est demandée).",
					"« Fermer la table » = le client a payé, la table est de nouveau libre.",
					"📊 Vue d'ensemble = le total de toutes les tables actuellement ouvertes.",
					"Le client commande encore quelque chose en payant (par ex. « Encore un espresso, s’il vous plaît ») ? Appuyez sur « + Article » à sa table → choisissez l’article et la quantité → « Ajouter ». C’est aussitôt sur l’addition et part automatiquement en cuisine ou au bar.",
					"Quand une table demande l’addition (💳), une sonnerie retentit et la carte clignote brièvement en rouge. Activez-la ou désactivez-la en bas à gauche avec « Sonnerie ». Astuce : après avoir ouvert la page, touchez l’écran une fois – le navigateur n’autorise les sons qu’ensuite."
				]
			},
		workflowSteps: ["Les clients scannent le QR code", "Activer la table", "Tout le monde commande", "Distribution automatique", "Cuisine et bar préparent", "Les clients voient le statut en direct", "Recommander à tout moment", "Demander l'addition", "La table devient rouge", "Fermer la table"],
		noTables: 'Aucune table configurée.', floorTitle: 'Plan de salle', ordersTitle: 'Commandes',
		activityTitle: 'Activité en direct', viewAll: 'Tout voir', statusTitle: 'État des postes', summaryTitle: 'Résumé des commandes', today: "Aujourd'hui",
		qrOrders: 'Via QR code', staffOrders: 'Par le personnel', orderValue: "Valeur des commandes aujourd'hui", itemsLabel: 'articles',
		statusOpen: '{n} en attente', statusActiveTables: '{n} tables actives', statusBills: '{n} additions',
		evOpened: 'Table activée', evOrderGuest: 'Commande du client : {items}', evOrderStaff: '{who} a ajouté : {items}',
		evReadyKitchen: 'Cuisine : {n} prêts', evReadyBar: 'Bar : {n} prêts', evBill: 'Addition demandée', evClosed: 'Payée et fermée',
		timeJustNow: "à l'instant", timeMinutes: 'il y a {n} min', timeHours: 'il y a {n} h', noActivity: "Pas encore d'activité aujourd'hui.",
		historyTitle: "Historique d'aujourd'hui", noOpenOrders: 'Aucune commande ouverte pour le moment.',
		tileOpenOrders: 'Commandes ouvertes', tileOpenOrdersSub: "Toutes les tables actives d'un coup d'œil", tileHistorySub: "Tout ce qui s'est passé aujourd'hui",
		tileTotals: "Vue d'ensemble", tileTotalsSub: 'Total de toutes les tables ouvertes', tileHelp: 'Comment ça marche', tileHelpSub: 'Le déroulement en 10 étapes',
		chimeOn: 'Sonnerie activée', chimeOff: 'Sonnerie désactivée',
		privacyLink: 'Confidentialité', imprintLink: 'Mentions légales',
		offline: 'Pas de connexion Internet. La page se recharge automatiquement dès que vous êtes de nouveau en ligne.',
		linkIncomplete: 'Ce lien est incomplet.', linkInvalid: "Ce lien n'est plus valide.", actionFailed: "L'action a échoué.",
		tablesEmailLinkText: 'Lien de la table', tablesEmailHeading: 'QR codes des tables pour {name}', tablesEmailHint: 'Chaque QR code correspond à une seule table : imprimez-le et placez-le sur la bonne table. Les clients le scannent et peuvent commander dès que la table est activée dans le Service Hub.',
		onboardingHeading: 'Smart ServiceHub™ – informations d’accès pour {name}', staffHeading: 'Accès du personnel'
	}
};
