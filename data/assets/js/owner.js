/* "SmartPilot" - the restaurant owner's app (owner.html?t=<token>).
   Everything comes from the owner-app Edge Function; the token in the link
   is the only credential (see 0035_owner_app.sql). Installable via pwa.js /
   manifest-owner.webmanifest, which keeps ?t= in the installed app's start
   URL. Texts in the 8 languages of the staff screens; the owner picks one at
   the bottom, remembered on this device. */
(function () {
	const params = new URLSearchParams(location.search);
	const token = params.get('t') || '';
	// Also the order of the language buttons.
	const LANGS = ['de', 'en', 'el', 'it', 'es', 'fr', 'nl', 'pt'];
	const LOCALES = { de: 'de-DE', en: 'en-GB', el: 'el-GR', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', nl: 'nl-NL', pt: 'pt-PT' };
	const LANG_KEY = 'smartmenu.owner.lang';
	const SITE = 'https://smartmenusolutions.com';
	const CONTACT = 'info@smartmenusolutions.com';
	const PLAN_NAMES = { start: 'Smart Start', pro: 'Smart Pro', premium: 'Smart Premium', discovery: 'Smart Discovery' };

	const TEXT = {
		de: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Wird geladen …',
			invalidTitle: 'Link nicht gültig', invalid: 'Bitte wenden Sie sich an {contact}.',
			offlineTitle: 'Keine Verbindung', offline: 'Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.', retry: 'Erneut versuchen',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Als App installieren', installText: 'Immer griffbereit auf Ihrem Startbildschirm.', install: 'Installieren',
			installIos: 'Tippen Sie unten auf das Teilen-Symbol und dann auf „Zum Home-Bildschirm“.',
			views: 'Aufrufe der Speisekarte · letzte 7 Tage', vsPrev: '{p} % zur Vorwoche', noViews: 'In den letzten 7 Tagen gab es noch keine Aufrufe.',
			topDishes: 'Beliebteste Gerichte', fullReport: 'Ganzer Bericht →',
			lockedTitle: 'Wie oft wird Ihre Speisekarte geöffnet?', lockedText: 'Mit Smart WeeklyReport™ sehen Sie hier jede Woche Ihre Aufrufe und Ihre beliebtesten Gerichte.',
			lockedButton: 'WeeklyReport hinzufügen', lockedAsk: 'Bei uns anfragen',
			plan: 'Ihr Paket', activeUntil: 'aktiv bis {date}', expiredOn: 'abgelaufen am {date} – bitte verlängern', inactive: 'nicht aktiv',
			discoveryWaiting: 'startet, sobald Ihre Speisekarte online ist', discoveryDay: 'Tag {n} von 7 · offline ab {date}', discoveryEnded: 'beendet am {date}',
			addons: 'Zusatzmodule',
			openMenu: 'Speisekarte öffnen', qr: 'QR-Code', tableCards: 'Tischkarten', change: 'Änderung schicken', addonsTile: 'Zusatzmodule', renew: 'Verlängern', upgrade: 'Upgrade',
			changeSubject: 'Änderung Speisekarte – {name}', changeBody: 'Hallo Smart Menu Solutions Team,\n\nbitte ändern Sie in unserer Speisekarte Folgendes:\n\n',
			questions: 'Fragen? {contact}', privacy: 'Datenschutz', privacyPath: '/de/privacy-policy.html',
			popupBlocked: 'Bitte erlauben Sie Pop-ups für diese Seite.', language: 'Sprache', close: 'Schließen',
			cards: { title: 'Tischkarten – {name}', print: 'Drucken / als PDF speichern', summaryTables: '{tables} Tische mit „Scannen & bestellen“, dazu ein Blatt „Einfach scannen“ für Eingang, Bar oder Fenster – {sheets} Blätter A4.', summaryMenu: 'Ein Blatt A4 mit 4 Karten „Einfach scannen“.', hint: 'Entlang der gestrichelten Linien schneiden, am besten dickeres Papier (ab 250 g/m²). Im Druckdialog Skalierung 100 % wählen.' }
		},
		en: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Loading …',
			invalidTitle: 'Link not valid', invalid: 'Please contact {contact}.',
			offlineTitle: 'No connection', offline: 'Please check your internet connection and try again.', retry: 'Try again',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Install as an app', installText: 'Always at hand on your home screen.', install: 'Install',
			installIos: 'Tap the share icon at the bottom, then "Add to Home Screen".',
			views: 'Menu views · last 7 days', vsPrev: '{p} % vs. last week', noViews: 'No views in the last 7 days yet.',
			topDishes: 'Most popular dishes', fullReport: 'Full report →',
			lockedTitle: 'How often is your menu opened?', lockedText: 'With Smart WeeklyReport™ you see your views and your most popular dishes here every week.',
			lockedButton: 'Add WeeklyReport', lockedAsk: 'Ask us',
			plan: 'Your plan', activeUntil: 'active until {date}', expiredOn: 'expired on {date} – please renew', inactive: 'not active',
			discoveryWaiting: 'starts once your menu is online', discoveryDay: 'Day {n} of 7 · offline from {date}', discoveryEnded: 'ended on {date}',
			addons: 'Add-ons',
			openMenu: 'Open menu', qr: 'QR code', tableCards: 'Table cards', change: 'Send a change', addonsTile: 'Add-ons', renew: 'Renew', upgrade: 'Upgrade',
			changeSubject: 'Menu change – {name}', changeBody: 'Hello Smart Menu Solutions team,\n\nplease change the following in our menu:\n\n',
			questions: 'Questions? {contact}', privacy: 'Privacy', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Please allow pop-ups for this page.', language: 'Language', close: 'Close',
			cards: { title: 'Table cards – {name}', print: 'Print / save as PDF', summaryTables: '{tables} tables with "Scan & order", plus one sheet of "Just scan" cards for the entrance, bar or window – {sheets} A4 sheets.', summaryMenu: 'One A4 sheet with 4 "Just scan" cards.', hint: 'Cut along the dashed lines, ideally on thicker paper (250 g/m² or more). Choose 100% scale in the print dialog.' }
		},
		it: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Caricamento …',
			invalidTitle: 'Link non valido', invalid: 'Contattateci a {contact}.',
			offlineTitle: 'Nessuna connessione', offline: 'Controllate la connessione a internet e riprovate.', retry: 'Riprova',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Installa come app', installText: 'Sempre a portata di mano sulla schermata Home.', install: 'Installa',
			installIos: 'Toccate l\'icona di condivisione in basso e poi "Aggiungi alla schermata Home".',
			views: 'Visite al menu · ultimi 7 giorni', vsPrev: '{p} % rispetto alla settimana scorsa', noViews: 'Nessuna visita negli ultimi 7 giorni.',
			topDishes: 'Piatti più visti', fullReport: 'Report completo →',
			lockedTitle: 'Quante volte viene aperto il vostro menu?', lockedText: 'Con Smart WeeklyReport™ vedete qui ogni settimana le visite e i piatti più visti.',
			lockedButton: 'Aggiungi WeeklyReport', lockedAsk: 'Scriveteci',
			plan: 'Il vostro piano', activeUntil: 'attivo fino al {date}', expiredOn: 'scaduto il {date} – rinnovate', inactive: 'non attivo',
			discoveryWaiting: 'inizia quando il vostro menu è online', discoveryDay: 'Giorno {n} di 7 · offline dal {date}', discoveryEnded: 'terminato il {date}',
			addons: 'Add-on',
			openMenu: 'Apri il menu', qr: 'QR code', tableCards: 'Segnatavolo', change: 'Invia una modifica', addonsTile: 'Add-on', renew: 'Rinnova', upgrade: 'Upgrade',
			changeSubject: 'Modifica menu – {name}', changeBody: 'Buongiorno Smart Menu Solutions Team,\n\nvi preghiamo di modificare nel nostro menu:\n\n',
			questions: 'Domande? {contact}', privacy: 'Privacy', privacyPath: '/it/privacy-policy.html',
			popupBlocked: 'Consentite i pop-up per questa pagina.', language: 'Lingua', close: 'Chiudi',
			cards: { title: 'Segnatavolo – {name}', print: 'Stampa / salva come PDF', summaryTables: '{tables} tavoli con "Scansionate e ordinate", più un foglio "Basta scansionare" per ingresso, bar o vetrina – {sheets} fogli A4.', summaryMenu: 'Un foglio A4 con 4 segnatavolo "Basta scansionare".', hint: 'Tagliate lungo le linee tratteggiate, meglio su carta più spessa (da 250 g/m²). Nella finestra di stampa scegliete scala 100 %.' }
		},
		el: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Φόρτωση …',
			invalidTitle: 'Μη έγκυρος σύνδεσμος', invalid: 'Επικοινωνήστε μαζί μας στο {contact}.',
			offlineTitle: 'Χωρίς σύνδεση', offline: 'Ελέγξτε τη σύνδεσή σας στο διαδίκτυο και δοκιμάστε ξανά.', retry: 'Δοκιμάστε ξανά',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Εγκατάσταση ως εφαρμογή', installText: 'Πάντα διαθέσιμη στην αρχική σας οθόνη.', install: 'Εγκατάσταση',
			installIos: 'Πατήστε κάτω το εικονίδιο κοινοποίησης και μετά «Προσθήκη στην οθόνη Αφετηρίας».',
			views: 'Προβολές μενού · τελευταίες 7 ημέρες', vsPrev: '{p} % σε σχέση με την προηγούμενη εβδομάδα', noViews: 'Δεν υπάρχουν ακόμη προβολές τις τελευταίες 7 ημέρες.',
			topDishes: 'Τα πιο δημοφιλή πιάτα', fullReport: 'Πλήρης αναφορά →',
			lockedTitle: 'Πόσο συχνά ανοίγει το μενού σας;', lockedText: 'Με το Smart WeeklyReport™ βλέπετε εδώ κάθε εβδομάδα τις προβολές και τα πιο δημοφιλή σας πιάτα.',
			lockedButton: 'Προσθήκη WeeklyReport', lockedAsk: 'Ρωτήστε μας',
			plan: 'Το πακέτο σας', activeUntil: 'ενεργό έως {date}', expiredOn: 'έληξε στις {date} – ανανεώστε το', inactive: 'ανενεργό',
			discoveryWaiting: 'ξεκινά μόλις το μενού σας είναι online', discoveryDay: 'Ημέρα {n} από 7 · offline από {date}', discoveryEnded: 'έληξε στις {date}',
			addons: 'Πρόσθετα',
			openMenu: 'Άνοιγμα μενού', qr: 'QR code', tableCards: 'Κάρτες τραπεζιού', change: 'Αποστολή αλλαγής', addonsTile: 'Πρόσθετα', renew: 'Ανανέωση', upgrade: 'Αναβάθμιση',
			changeSubject: 'Αλλαγή μενού – {name}', changeBody: 'Γεια σας, ομάδα Smart Menu Solutions,\n\nπαρακαλούμε αλλάξτε τα εξής στο μενού μας:\n\n',
			questions: 'Ερωτήσεις; {contact}', privacy: 'Απόρρητο', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Επιτρέψτε τα αναδυόμενα παράθυρα για αυτή τη σελίδα.', language: 'Γλώσσα', close: 'Κλείσιμο',
			cards: { title: 'Κάρτες τραπεζιού – {name}', print: 'Εκτύπωση / αποθήκευση ως PDF', summaryTables: '{tables} τραπέζια με «Σκανάρετε & παραγγείλετε», και ένα φύλλο «Απλώς σκανάρετε» για είσοδο, μπαρ ή βιτρίνα – {sheets} φύλλα A4.', summaryMenu: 'Ένα φύλλο A4 με 4 κάρτες «Απλώς σκανάρετε».', hint: 'Κόψτε κατά μήκος των διακεκομμένων γραμμών, ιδανικά σε πιο χοντρό χαρτί (από 250 g/m²). Στο παράθυρο εκτύπωσης επιλέξτε κλίμακα 100 %.' }
		},
		es: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Cargando …',
			invalidTitle: 'Enlace no válido', invalid: 'Póngase en contacto con {contact}.',
			offlineTitle: 'Sin conexión', offline: 'Compruebe su conexión a internet e inténtelo de nuevo.', retry: 'Reintentar',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Instalar como app', installText: 'Siempre a mano en su pantalla de inicio.', install: 'Instalar',
			installIos: 'Toque abajo el icono de compartir y luego «Añadir a pantalla de inicio».',
			views: 'Visitas a la carta · últimos 7 días', vsPrev: '{p} % frente a la semana pasada', noViews: 'Aún no hay visitas en los últimos 7 días.',
			topDishes: 'Platos más populares', fullReport: 'Informe completo →',
			lockedTitle: '¿Cuántas veces se abre su carta?', lockedText: 'Con Smart WeeklyReport™ verá aquí cada semana sus visitas y sus platos más populares.',
			lockedButton: 'Añadir WeeklyReport', lockedAsk: 'Consúltenos',
			plan: 'Su plan', activeUntil: 'activo hasta el {date}', expiredOn: 'caducó el {date} – renuévelo', inactive: 'no activo',
			discoveryWaiting: 'empieza en cuanto su carta esté online', discoveryDay: 'Día {n} de 7 · offline desde el {date}', discoveryEnded: 'finalizó el {date}',
			addons: 'Complementos',
			openMenu: 'Abrir la carta', qr: 'Código QR', tableCards: 'Tarjetas de mesa', change: 'Enviar un cambio', addonsTile: 'Complementos', renew: 'Renovar', upgrade: 'Mejorar plan',
			changeSubject: 'Cambio en la carta – {name}', changeBody: 'Hola, equipo de Smart Menu Solutions:\n\npor favor, cambien lo siguiente en nuestra carta:\n\n',
			questions: '¿Preguntas? {contact}', privacy: 'Privacidad', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Permita las ventanas emergentes para esta página.', language: 'Idioma', close: 'Cerrar',
			cards: { title: 'Tarjetas de mesa – {name}', print: 'Imprimir / guardar como PDF', summaryTables: '{tables} mesas con «Escanee y pida», más una hoja «Simplemente escanee» para la entrada, la barra o el escaparate – {sheets} hojas A4.', summaryMenu: 'Una hoja A4 con 4 tarjetas «Simplemente escanee».', hint: 'Corte por las líneas discontinuas, mejor en papel grueso (desde 250 g/m²). En el diálogo de impresión elija escala 100 %.' }
		},
		fr: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Chargement …',
			invalidTitle: 'Lien non valide', invalid: 'Veuillez nous contacter à {contact}.',
			offlineTitle: 'Pas de connexion', offline: 'Vérifiez votre connexion internet et réessayez.', retry: 'Réessayer',
			online: '● En ligne', notOnline: '● Hors ligne',
			installTitle: 'Installer comme application', installText: 'Toujours à portée de main sur votre écran d\'accueil.', install: 'Installer',
			installIos: 'Touchez en bas l\'icône de partage, puis « Sur l\'écran d\'accueil ».',
			views: 'Vues de la carte · 7 derniers jours', vsPrev: '{p} % par rapport à la semaine dernière', noViews: 'Aucune vue au cours des 7 derniers jours.',
			topDishes: 'Plats les plus consultés', fullReport: 'Rapport complet →',
			lockedTitle: 'Combien de fois votre carte est-elle ouverte ?', lockedText: 'Avec Smart WeeklyReport™, vous voyez ici chaque semaine vos vues et vos plats les plus consultés.',
			lockedButton: 'Ajouter WeeklyReport', lockedAsk: 'Nous contacter',
			plan: 'Votre formule', activeUntil: 'active jusqu\'au {date}', expiredOn: 'expirée le {date} – veuillez renouveler', inactive: 'non active',
			discoveryWaiting: 'commence dès que votre carte est en ligne', discoveryDay: 'Jour {n} sur 7 · hors ligne à partir du {date}', discoveryEnded: 'terminée le {date}',
			addons: 'Modules complémentaires',
			openMenu: 'Ouvrir la carte', qr: 'QR code', tableCards: 'Chevalets de table', change: 'Envoyer une modification', addonsTile: 'Modules', renew: 'Renouveler', upgrade: 'Mettre à niveau',
			changeSubject: 'Modification de la carte – {name}', changeBody: 'Bonjour l\'équipe Smart Menu Solutions,\n\nmerci de modifier les points suivants dans notre carte :\n\n',
			questions: 'Des questions ? {contact}', privacy: 'Confidentialité', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Veuillez autoriser les fenêtres pop-up pour cette page.', language: 'Langue', close: 'Fermer',
			cards: { title: 'Chevalets de table – {name}', print: 'Imprimer / enregistrer en PDF', summaryTables: '{tables} tables avec « Scannez & commandez », plus une feuille « Scannez simplement » pour l\'entrée, le bar ou la vitrine – {sheets} feuilles A4.', summaryMenu: 'Une feuille A4 avec 4 cartes « Scannez simplement ».', hint: 'Découpez le long des pointillés, idéalement sur du papier épais (250 g/m² ou plus). Dans la fenêtre d\'impression, choisissez l\'échelle 100 %.' }
		},
		nl: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'Laden …',
			invalidTitle: 'Link niet geldig', invalid: 'Neem contact met ons op via {contact}.',
			offlineTitle: 'Geen verbinding', offline: 'Controleer uw internetverbinding en probeer het opnieuw.', retry: 'Opnieuw proberen',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Als app installeren', installText: 'Altijd bij de hand op uw beginscherm.', install: 'Installeren',
			installIos: 'Tik onderaan op het deelsymbool en daarna op "Zet op beginscherm".',
			views: 'Weergaven van de menukaart · laatste 7 dagen', vsPrev: '{p} % t.o.v. vorige week', noViews: 'Nog geen weergaven in de laatste 7 dagen.',
			topDishes: 'Populairste gerechten', fullReport: 'Volledig rapport →',
			lockedTitle: 'Hoe vaak wordt uw menukaart geopend?', lockedText: 'Met Smart WeeklyReport™ ziet u hier elke week uw weergaven en uw populairste gerechten.',
			lockedButton: 'WeeklyReport toevoegen', lockedAsk: 'Vraag het ons',
			plan: 'Uw pakket', activeUntil: 'actief tot {date}', expiredOn: 'verlopen op {date} – verleng a.u.b.', inactive: 'niet actief',
			discoveryWaiting: 'start zodra uw menukaart online staat', discoveryDay: 'Dag {n} van 7 · offline vanaf {date}', discoveryEnded: 'beëindigd op {date}',
			addons: 'Uitbreidingen',
			openMenu: 'Menukaart openen', qr: 'QR-code', tableCards: 'Tafelkaarten', change: 'Wijziging sturen', addonsTile: 'Uitbreidingen', renew: 'Verlengen', upgrade: 'Upgraden',
			changeSubject: 'Wijziging menukaart – {name}', changeBody: 'Hallo Smart Menu Solutions-team,\n\nwilt u het volgende in onze menukaart wijzigen:\n\n',
			questions: 'Vragen? {contact}', privacy: 'Privacy', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Sta pop-ups toe voor deze pagina.', language: 'Taal', close: 'Sluiten',
			cards: { title: 'Tafelkaarten – {name}', print: 'Afdrukken / opslaan als pdf', summaryTables: '{tables} tafels met "Scannen & bestellen", plus één vel "Gewoon scannen" voor de ingang, de bar of het raam – {sheets} vellen A4.', summaryMenu: 'Eén vel A4 met 4 kaarten "Gewoon scannen".', hint: 'Knip langs de stippellijnen, liefst op dikker papier (vanaf 250 g/m²). Kies in het afdrukvenster schaal 100 %.' }
		},
		pt: {
			appName: 'SmartPilot™', shortName: 'SmartPilot™', loading: 'A carregar …',
			invalidTitle: 'Link inválido', invalid: 'Contacte-nos através de {contact}.',
			offlineTitle: 'Sem ligação', offline: 'Verifique a sua ligação à internet e tente novamente.', retry: 'Tentar novamente',
			online: '● Online', notOnline: '● Offline',
			installTitle: 'Instalar como app', installText: 'Sempre à mão no seu ecrã principal.', install: 'Instalar',
			installIos: 'Toque em baixo no ícone de partilha e depois em "Adicionar ao ecrã principal".',
			views: 'Visualizações do menu · últimos 7 dias', vsPrev: '{p} % face à semana passada', noViews: 'Ainda sem visualizações nos últimos 7 dias.',
			topDishes: 'Pratos mais populares', fullReport: 'Relatório completo →',
			lockedTitle: 'Quantas vezes é aberto o seu menu?', lockedText: 'Com o Smart WeeklyReport™ vê aqui todas as semanas as suas visualizações e os seus pratos mais populares.',
			lockedButton: 'Adicionar WeeklyReport', lockedAsk: 'Fale connosco',
			plan: 'O seu plano', activeUntil: 'ativo até {date}', expiredOn: 'expirou a {date} – renove, por favor', inactive: 'inativo',
			discoveryWaiting: 'começa assim que o seu menu estiver online', discoveryDay: 'Dia {n} de 7 · offline a partir de {date}', discoveryEnded: 'terminou a {date}',
			addons: 'Extras',
			openMenu: 'Abrir menu', qr: 'Código QR', tableCards: 'Cartões de mesa', change: 'Enviar alteração', addonsTile: 'Extras', renew: 'Renovar', upgrade: 'Upgrade',
			changeSubject: 'Alteração do menu – {name}', changeBody: 'Olá, equipa Smart Menu Solutions,\n\npor favor alterem o seguinte no nosso menu:\n\n',
			questions: 'Dúvidas? {contact}', privacy: 'Privacidade', privacyPath: '/privacy-policy.html',
			popupBlocked: 'Permita janelas pop-up para esta página.', language: 'Idioma', close: 'Fechar',
			cards: { title: 'Cartões de mesa – {name}', print: 'Imprimir / guardar como PDF', summaryTables: '{tables} mesas com "Digitalize e peça", mais uma folha "Basta digitalizar" para a entrada, o bar ou a montra – {sheets} folhas A4.', summaryMenu: 'Uma folha A4 com 4 cartões "Basta digitalizar".', hint: 'Corte pelas linhas tracejadas, de preferência em papel mais grosso (a partir de 250 g/m²). Na janela de impressão escolha escala 100 %.' }
		}
	};

	const ICONS = {
		menu: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
		qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20h.01M17 17h3v3"/>',
		cards: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
		change: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		addons: '<path d="M12 3v18M3 12h18"/>',
		renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'
	};

	function savedLang() {
		try {
			const saved = localStorage.getItem(LANG_KEY);
			return LANGS.includes(saved) ? saved : null;
		} catch { return null; }
	}
	// The owner's own pick on this device wins over the ?lang= of the link
	// (which an installed app keeps in its start URL).
	let chosen = savedLang() || (LANGS.includes(params.get('lang')) ? params.get('lang') : null);
	let lang = chosen;
	let data = null;
	let installPrompt = null;
	const app = document.getElementById('app');

	function t() { return TEXT[lang || 'de']; }
	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
	}
	function icon(name) {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
	}
	function formatDate(iso) {
		const date = new Date(`${iso}T12:00:00Z`);
		return date.toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
	function addDays(iso, days) {
		const date = new Date(`${iso}T12:00:00Z`);
		date.setUTCDate(date.getUTCDate() + days);
		return date.toISOString().slice(0, 10);
	}
	function weekday(iso) {
		return new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALES[lang], { weekday: 'short' }).replace('.', '');
	}

	function setLanguage(next) {
		lang = LANGS.includes(next) ? next : 'de';
		document.documentElement.lang = lang;
		// Read by pwa.js when it rebuilds the manifest on the title change below.
		const manifest = document.querySelector('link[rel="manifest"]');
		if (manifest) manifest.dataset.shortName = t().shortName;
		const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
		if (appleTitle) appleTitle.content = t().shortName;
	}

	function showMessage(title, text, retry) {
		app.innerHTML = `<div class="owner-error"><b>${escapeHtml(title)}</b>${escapeHtml(text)}${retry ? `<p><button type="button" class="o-btn" id="retry">${escapeHtml(t().retry)}</button></p>` : ''}</div>`;
		if (retry) document.getElementById('retry').addEventListener('click', load);
	}

	function fetchData() {
		const query = new URLSearchParams({ t: token });
		if (chosen) query.set('lang', chosen);
		return fetch(`${AUTH_CONFIG.supabaseUrl}/functions/v1/owner-app?${query}`, { cache: 'no-store' });
	}

	async function load() {
		setLanguage(lang || (navigator.language || 'de').slice(0, 2));
		app.innerHTML = `<p class="owner-loading">${escapeHtml(t().loading)}</p>`;
		if (!/^[0-9a-f-]{36}$/i.test(token)) {
			showMessage(t().invalidTitle, t().invalid.replace('{contact}', CONTACT));
			return;
		}
		let response;
		try {
			response = await fetchData();
		} catch {
			showMessage(t().offlineTitle, t().offline, true);
			return;
		}
		if (response.status === 400 || response.status === 404) {
			showMessage(t().invalidTitle, t().invalid.replace('{contact}', CONTACT));
			return;
		}
		if (!response.ok) {
			showMessage(t().offlineTitle, t().offline, true);
			return;
		}
		data = await response.json();
		// Nothing picked and no ?lang= in the link: the language the customer
		// ordered in.
		if (!chosen) setLanguage(data.lang);
		render();
	}

	// Switching language re-renders at once, then quietly fetches again for
	// dish names and website links in that language.
	async function switchLanguage(next) {
		if (!LANGS.includes(next) || next === lang) return;
		chosen = next;
		try { localStorage.setItem(LANG_KEY, next); } catch { /* this visit only */ }
		setLanguage(next);
		render();
		try {
			const response = await fetchData();
			if (response.ok && chosen === next) {
				data = await response.json();
				render();
			}
		} catch { /* keep what is shown */ }
	}

	function statsHtml() {
		const text = t();
		if (!data.stats) {
			// An expired or ended plan needs renewing first, not an add-on offer.
			if (data.subscription && data.subscription.status !== 'active') return '';
			const action = data.links.addons
				? `<a class="o-btn" href="${escapeHtml(data.links.addons)}">${escapeHtml(text.lockedButton)}</a>`
				: `<a class="o-btn" href="mailto:${CONTACT}?subject=${encodeURIComponent(`Smart WeeklyReport – ${data.name}`)}">${escapeHtml(text.lockedAsk)}</a>`;
			return `<section class="o-card o-locked"><h3>${escapeHtml(text.lockedTitle)}</h3><p>${escapeHtml(text.lockedText)}</p>${action}</section>`;
		}
		const { days, total, previous, topDishes } = data.stats;
		const max = Math.max(1, ...days.map((day) => day.visits));
		const sorted = [...days].map((day) => day.visits).sort((a, b) => b - a);
		const highlight = sorted[1] > 0 ? sorted[1] : sorted[0];
		let trend = '';
		if (previous > 0) {
			const change = Math.round(((total - previous) / previous) * 100);
			trend = `<span class="o-trend${change < 0 ? ' o-trend--down' : ''}">${change < 0 ? '▼' : '▲'} ${escapeHtml(text.vsPrev.replace('{p}', Math.abs(change)))}</span>`;
		}
		const bars = days.map((day) => `<div class="${day.visits > 0 && day.visits >= highlight ? 'hi' : ''}" style="height:${Math.max(4, Math.round((day.visits / max) * 100))}%" title="${day.visits}"></div>`).join('');
		const labels = days.map((day) => `<span>${escapeHtml(weekday(day.day))}</span>`).join('');
		const dishes = topDishes.length
			? `<ul class="o-list">${topDishes.map((dish, index) => `<li><b>${index + 1}. ${escapeHtml(dish.label)}</b><span>${dish.count}×</span></li>`).join('')}</ul>`
			: '';
		return `<section class="o-card">
			<h2>${escapeHtml(text.views)}</h2>
			<div class="o-big"><b>${total}</b>${trend}</div>
			${total ? `<div class="o-bars">${bars}</div><div class="o-days">${labels}</div>` : `<p class="o-empty">${escapeHtml(text.noViews)}</p>`}
		</section>
		${dishes ? `<section class="o-card"><h2>${escapeHtml(text.topDishes)}</h2>${dishes}${data.links.stats ? `<a class="o-more" href="${escapeHtml(data.links.stats)}">${escapeHtml(text.fullReport)}</a>` : ''}</section>` : ''}`;
	}

	function planHtml() {
		const text = t();
		const sub = data.subscription;
		if (!sub) return '';
		let detail = ''; // HTML, escaped below
		if (sub.plan === 'discovery') {
			if (!sub.discoveryStartedOn) detail = escapeHtml(text.discoveryWaiting);
			else {
				const end = addDays(sub.discoveryStartedOn, 7);
				const today = new Date().toISOString().slice(0, 10);
				const day = Math.floor((Date.parse(today) - Date.parse(sub.discoveryStartedOn)) / 86400000) + 1;
				detail = escapeHtml(today >= end || sub.status !== 'active'
					? text.discoveryEnded.replace('{date}', formatDate(end))
					: text.discoveryDay.replace('{n}', Math.min(7, Math.max(1, day))).replace('{date}', formatDate(end)));
			}
		} else if (sub.status === 'active') detail = escapeHtml(text.activeUntil.replace('{date}', formatDate(sub.periodEnd)));
		else if (sub.status === 'expired') detail = `<span class="o-warn">${escapeHtml(text.expiredOn.replace('{date}', formatDate(sub.periodEnd)))}</span>`;
		else detail = escapeHtml(text.inactive);
		const addons = [
			['weeklyReport', 'Smart WeeklyReport™'],
			['foodMatch', 'Smart FoodMatch™'],
			['dishPhoto', 'Smart DishPhoto™'],
			['serviceHub', 'Smart ServiceHub™']
		].map(([key, label]) => `<span class="o-chip${data.addons[key] ? ' o-chip--on' : ''}">${data.addons[key] ? '✓ ' : ''}${label}</span>`).join('');
		return `<section class="o-card">
			<div class="o-plan"><div><h2>${escapeHtml(text.plan)}</h2><b>${escapeHtml(PLAN_NAMES[sub.plan] || sub.plan)}</b></div><span>${detail}</span></div>
			<div class="o-chips" aria-label="${escapeHtml(text.addons)}">${addons}</div>
		</section>`;
	}

	function tilesHtml() {
		const text = t();
		const tiles = [
			`<button type="button" class="o-tile" id="openMenu">${icon('menu')}${escapeHtml(text.openMenu)}</button>`,
			`<button type="button" class="o-tile" id="downloadQr">${icon('qr')}${escapeHtml(text.qr)}</button>`,
			`<button type="button" class="o-tile" id="tableCards">${icon('cards')}${escapeHtml(text.tableCards)}</button>`,
			`<a class="o-tile" href="mailto:${CONTACT}?subject=${encodeURIComponent(text.changeSubject.replace('{name}', data.name))}&body=${encodeURIComponent(text.changeBody)}">${icon('change')}${escapeHtml(text.change)}</a>`
		];
		if (data.links.addons) tiles.push(`<a class="o-tile" href="${escapeHtml(data.links.addons)}">${icon('addons')}${escapeHtml(text.addonsTile)}</a>`);
		if (data.links.renewal) tiles.push(`<a class="o-tile" href="${escapeHtml(data.links.renewal)}">${icon('renew')}${escapeHtml(data.subscription?.plan === 'discovery' ? text.upgrade : text.renew)}</a>`);
		return `<nav class="o-tiles">${tiles.join('')}</nav>`;
	}

	function isStandalone() {
		return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	}
	function installDismissed() {
		try { return localStorage.getItem('smartmenu.owner.installDismissed') === '1'; } catch { return false; }
	}
	function installHtml() {
		if (isStandalone() || installDismissed()) return '';
		const text = t();
		const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		if (isIos) {
			return `<div class="o-install" id="install"><img src="assets/icons/icon-192.png" alt=""><p><b>${escapeHtml(text.installTitle)}</b>${escapeHtml(text.installIos)}</p><button type="button" class="o-install-close" id="installClose" aria-label="×">×</button></div>`;
		}
		if (!installPrompt) return '';
		return `<div class="o-install" id="install"><img src="assets/icons/icon-192.png" alt=""><p><b>${escapeHtml(text.installTitle)}</b>${escapeHtml(text.installText)}</p><button type="button" class="o-btn" id="installButton">${escapeHtml(text.install)}</button><button type="button" class="o-install-close" id="installClose" aria-label="×">×</button></div>`;
	}

	function langsHtml() {
		const buttons = LANGS.map((code) => `<button type="button" data-lang="${code}"${code === lang ? ' class="on" aria-current="true"' : ''}>${code.toUpperCase()}</button>`).join('');
		return `<nav class="o-langs" aria-label="${escapeHtml(t().language)}">${buttons}</nav>`;
	}

	// The menu opens inside the app: a link out of the installed app would
	// land in the browser's in-app tab with its own toolbar. Back closes it.
	function viewerUrl() {
		const url = new URL(data.menuUrl);
		if (data.languages.includes(lang)) url.searchParams.set('lang', lang);
		return url.href;
	}
	function openViewer() {
		if (document.getElementById('viewer')) return;
		const viewer = document.createElement('div');
		viewer.className = 'o-viewer';
		viewer.id = 'viewer';
		viewer.innerHTML = `<div class="o-viewer-bar"><b>${escapeHtml(data.name)}</b><button type="button" id="viewerClose" aria-label="${escapeHtml(t().close)}">×</button></div><iframe src="${escapeHtml(viewerUrl())}" title="${escapeHtml(data.name)}"></iframe>`;
		document.body.appendChild(viewer);
		document.body.classList.add('o-viewing');
		history.pushState({ ownerViewer: true }, '');
		document.getElementById('viewerClose').addEventListener('click', () => history.back());
	}
	function closeViewer() {
		document.getElementById('viewer')?.remove();
		document.body.classList.remove('o-viewing');
	}
	window.addEventListener('popstate', closeViewer);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && document.getElementById('viewer')) history.back();
	});

	function render() {
		const text = t();
		document.title = `${data.name} · ${text.appName}`;
		const head = data.logoUrl
			? `<img src="${escapeHtml(data.logoUrl)}" alt="">`
			: `<span class="o-initial">${escapeHtml((data.name || '?').trim().charAt(0).toUpperCase())}</span>`;
		app.innerHTML = `
			${installHtml()}
			<header class="o-head">${head}<div><h1>${escapeHtml(text.appName)}</h1><p>${escapeHtml(data.name)}</p></div><span class="o-status${data.isPublished ? '' : ' o-status--off'}">${escapeHtml(data.isPublished ? text.online : text.notOnline)}</span></header>
			${planHtml()}
			${statsHtml()}
			${tilesHtml()}
			${langsHtml()}
			<footer class="o-foot">${escapeHtml(text.questions).replace('{contact}', `<a href="mailto:${CONTACT}">${CONTACT}</a>`)}<br><a href="${SITE}${text.privacyPath}" target="_blank" rel="noopener">${escapeHtml(text.privacy)}</a></footer>`;
		bind();
	}

	function bind() {
		const text = t();
		document.getElementById('openMenu').addEventListener('click', openViewer);
		app.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => switchLanguage(button.dataset.lang)));
		document.getElementById('downloadQr').addEventListener('click', () => {
			const link = document.createElement('a');
			link.href = SmartQr.draw(data.menuUrl, 1200, 'M', 4).toDataURL('image/png');
			link.download = `${data.slug}-qr.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
		});
		document.getElementById('tableCards').addEventListener('click', () => {
			const win = window.open('', '_blank');
			if (!win) { alert(text.popupBlocked); return; }
			SmartTableCards.write(win, { name: data.name, logoUrl: data.logoUrl, headerFont: data.headerFont, languages: data.languages, menuUrl: data.menuUrl }, data.tables, text.cards);
		});
		const close = document.getElementById('installClose');
		if (close) close.addEventListener('click', () => {
			try { localStorage.setItem('smartmenu.owner.installDismissed', '1'); } catch { /* convenience only */ }
			document.getElementById('install').remove();
		});
		const install = document.getElementById('installButton');
		if (install) install.addEventListener('click', async () => {
			if (!installPrompt) return;
			installPrompt.prompt();
			await installPrompt.userChoice.catch(() => null);
			installPrompt = null;
			document.getElementById('install')?.remove();
		});
	}

	// Chrome/Edge/Android offer their own install dialog - kept for the
	// banner's button instead of the browser's mini-infobar.
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		installPrompt = event;
		if (data && !document.getElementById('install')) render();
	});
	window.addEventListener('appinstalled', () => document.getElementById('install')?.remove());

	load();
})();
