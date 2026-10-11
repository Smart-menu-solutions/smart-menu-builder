// User guide (guide.html): the whole customer lifecycle - order, Smart
// Discovery, setting up the menu, yearly renewal, upgrade, add-ons,
// ServiceHub, cancellation, deleting a client and every automatic email.
// Content per builder language (same localStorage key as admin.js), rendered
// by the small helpers below; diagrams are drawn here as HTML/SVG, so they
// follow the language too. Keep it in sync with the Edge Functions when a
// flow or an email changes.
(function () {
	const LANG_STORAGE_KEY = 'smartmenu.admin.lang';
	const LANGS = ['de', 'en', 'el'];

	const DELETE_SQL = `-- SLUG durch den Slug des Kunden ersetzen (Details → Slug), dann Run.
begin;
create temp table gone_customers on commit drop as
  select customer_id from public.subscriptions where menu_slug = 'SLUG';
-- ServiceHub (Bestellungen, Rufe, Tische, Personal-Zugänge)
delete from public.order_items
  where order_group_id in (select id from public.order_groups where menu_slug = 'SLUG')
     or serve_table_id in (select id from public.restaurant_tables where menu_slug = 'SLUG');
delete from public.waiter_calls
  where table_id in (select id from public.restaurant_tables where menu_slug = 'SLUG');
delete from public.order_groups where menu_slug = 'SLUG';
delete from public.restaurant_tables where menu_slug = 'SLUG';
delete from public.restaurant_access where menu_slug = 'SLUG';
-- Abo, Bestellungen, E-Mail-Protokoll
delete from public.notifications_log
  where subscription_id in (select id from public.subscriptions where menu_slug = 'SLUG');
delete from public.orders
  where subscription_id in (select id from public.subscriptions where menu_slug = 'SLUG');
delete from public.subscriptions where menu_slug = 'SLUG';
-- Kunde nur, wenn er kein weiteres Abo hat
delete from public.customers c
  using gone_customers g
  where c.id = g.customer_id
    and not exists (select 1 from public.subscriptions s where s.customer_id = c.id);
commit;`;

	const CONTENT = {
		de: {
			eyebrow: 'Anleitung',
			title: 'Vom Bestellen bis zur Verlängerung',
			intro: 'Alles, was rund um einen Kunden passiert: was der Kunde macht, was automatisch läuft und was du im Builder erledigst. Oben der Jahreskreislauf, darunter jeder Ablauf im Detail.',
			legend: { c: 'Kunde', a: 'Automatisch', y: 'Du' },
			toc: 'Inhalt',
			overview: {
				title: 'Der Jahreskreislauf eines Kunden',
				order: 'Bestellung\n& Zahlung', setup: 'Einrichtung\nim Builder', online: 'Online,\nQR-Code raus', year: 'Das Jahr\nläuft',
				remind: 'Erinnerung\n30 Tage vorher', renew: 'Automatische\nVerlängerung', ok: 'bezahlt: läuft ein weiteres Jahr',
				fail: 'Zahlung\nfehlgeschlagen', grace: '7 Tage Frist\nmit Zahlungslink', off: 'Offline\n(deaktiviert)', back: 'Zahlungslink bezahlt: sofort wieder online'
			},
			sections: [
				{
					id: 'order', title: 'Neue Bestellung (Jahrestarif)',
					lead: 'Smart Start, Smart Pro oder Smart Premium, auf Wunsch mit Zusatzmodulen. Von der Zahlung bis zur Einrichtung läuft alles automatisch.',
					flow: [
						['c', 'Bestellt auf der Website', 'Wählt Paket und Zusatzmodule, bestätigt „Ich bestelle als Unternehmen“ und zahlt über Stripe.'],
						['a', 'Bestätigung & neuer Kunde', 'Kunde: „Ihre Bestellung bei Smart Menu Solutions“ mit Upload-Link und Link für Zusatzmodule. Du: „Neue Bestellung eingegangen“. Im Builder steht der Kunde unter <b>Clients</b>, noch offline.'],
						['c', 'Lädt die Speisekarte hoch', 'Direkt nach der Zahlung: PDF oder bis zu 10 Fotos (werden zu einem PDF), Logo, Foto-Archiv. Später geht es über den Link in der Bestätigung.'],
						['a', 'Dateien an dich', 'E-Mail „Dateien zur Bestellung eingegangen“ mit den Dateien. Große Dateien kommen als Download-Link (30 Tage gültig).'],
						['y', 'Speisekarte einrichten', 'Im Builder, siehe <a href="#setup">Speisekarte einrichten</a>.'],
						['y', 'Online schalten & ausliefern', 'Karte online schalten, QR-Code und SmartPilot™-Link per Vorlage schicken.']
					],
					notes: [
						'Keine Dateien gekommen? Der Upload-Link steht in der Bestellbestätigung des Kunden. Er kann die Karte auch einfach per E-Mail an info@smartmenusolutions.com schicken.',
						'Nach der Bestellbestätigung gibt es keine Erstattung. Wir verkaufen nur an Unternehmen (AGB).'
					]
				},
				{
					id: 'discovery', title: 'Smart Discovery (7 Tage für 2,99 €)',
					lead: 'Einmalkauf zum Testen, kein Abo: bis zu 10 Gerichte und alle Zusatzmodule zum Ausprobieren. Die 7 Tage starten erst, wenn die Karte online ist, nicht beim Kauf.',
					timeline: [
						['Kauf', 'c', 'Kunde zahlt 2,99 €', 'Automatisch: „Willkommen bei Smart Discovery“ mit Upload-Link und Statistik-Link. Du: „Neue Bestellung eingegangen“.'],
						['Einrichtung', 'y', 'Du richtest die Karte ein', 'Bis zu 10 Gerichte. Dann im Tab <b>Zusatzmodule</b> „Speisekarte online“ einschalten und den QR-Code schicken.'],
						['Tag 1', 'a', 'Die 7 Tage starten', 'Mit dem nächsten täglichen Lauf (früh morgens) nach dem Online-Schalten. Im Tab Zusatzmodule steht oben „Tag X von 7“.'],
						['Tag 6', 'a', 'Bericht an den Kunden', '„Smart Discovery – Ihre Testphase endet bald: …“ mit Aufrufen, den beliebtesten Gerichten und dem Upgrade-Link. Du: „Smart-Discovery-Bericht verschickt“.'],
						['Tag 7', 'a', 'Ohne Upgrade: offline', 'Die Karte geht offline. Kunde: „Ihr Test mit Smart Discovery ist abgelaufen“. Du: „Smart Discovery abgelaufen (kein Upgrade)“.'],
						['Upgrade', 'c', 'Kunde wählt einen Jahrestarif', 'Über den Upgrade-Link aus dem Bericht oder „Link senden“ im Tab Zusatzmodule. Die 2,99 € werden angerechnet, die Karte bleibt bzw. kommt wieder online. Kunde: Bestellbestätigung. Du: „Upgrade von Smart Discovery“.']
					],
					notes: ['Beim Upgrade gelten nur die Zusatzmodule, die der Kunde dabei bezahlt. Die anderen aus dem Test gehen aus.']
				},
				{
					id: 'setup', title: 'Speisekarte im Builder einrichten',
					lead: 'Die Checkliste für jede neue Karte. Wir richten alles ein und pflegen jede Änderung, der Kunde ändert nie selbst.',
					steps: [
						'<b>Clients</b>: den Kunden auswählen. Neue Bestellungen stehen schon in der Liste.',
						'<b>Details</b>: Name, Adresse, Telefon, WhatsApp und Logo prüfen.',
						'<b>Menü & Fotos</b>: „Speisekarte als PDF oder Foto importieren“ → <b>Importieren</b>. Ergebnis prüfen: ein Preis <b>0,00</b> war auf dem Foto nicht lesbar, bitte von Hand eintragen. Fotos ergänzen.',
						'<b>Sprachen</b>: Ausgangssprache prüfen, Sprachen nach Paket anhaken (Start 1+1, Pro 1+3, Premium 1+6), dann <b>Automatisch übersetzen</b>.',
						'<b>Zusatzmodule</b>: gebuchte Module prüfen. Mit ServiceHub siehe <a href="#servicehub">ServiceHub</a>.',
						'<b>Zusatzmodule → Speisekarte online</b> einschalten, wenn die Karte fertig ist. Bei Smart Discovery starten damit die 7 Tage. Speichern.',
						'Rechte Spalte: <b>QR herunterladen</b>, bei Bedarf <b>Tischkarten drucken</b>, dann <b>App-Link für Inhaber kopieren</b> (der SmartPilot™-Link).',
						'<b>E-Mail-Vorlagen</b>: „Finished menu: QR code delivery (manual)“ und „SmartPilot™: app link (manual)“ in der Sprache des Kunden kopieren und schicken.'
					],
					notes: [
						'Änderungswünsche schickt der Kunde per E-Mail oder WhatsApp, wir ändern die Karte und speichern. Der QR-Code bleibt immer gleich.',
						'In Kundentexten nie „Sie können selbst ändern“ schreiben.',
						'Testen immer mit El Greco.'
					]
				},
				{
					id: 'renewal', title: 'Verlängerung (jedes Jahr automatisch)',
					lead: 'Jahrestarife verlängern sich automatisch über Stripe. Eingreifen musst du nur, wenn eine Warnung kommt oder ein Kunde nicht zahlt.',
					timeline: [
						['30 Tage vorher', 'a', 'Erinnerung', 'Kunde: „Ihr Abo verlängert sich am [Datum]“ mit Betrag und Links für Upgrade und Zusatzmodule. Gekündigte Abos bekommen keine.'],
						['Verlängerungstag', 'a', 'Stripe bucht ab', 'Klappt es: Kunde „Ihre Verlängerung bei Smart Menu Solutions“ (mit Link für eine neue Speisekarte), du „Automatische Verlängerung erfolgreich“. Fertig.'],
						['Wenn es nicht klappt', 'a', 'Zahlung fehlgeschlagen', 'Kunde: „Ihre Verlängerung ist fehlgeschlagen – bitte handeln“ mit Zahlungslink. Du: „Automatische Verlängerung fehlgeschlagen“. Die Karte bleibt noch 7 Tage online.'],
						['7 Tage später', 'a', 'Deaktiviert', 'Ohne Zahlung geht die Karte offline. Kunde: „Ihr Abo wurde deaktiviert“ (mit Zahlungslink). Du: „Abo automatisch deaktiviert“. Im Builder ist der Kunde gesperrt, oben steht der Verlängerungs-Link.'],
						['Danach', 'c', 'Kunde bezahlt über den Link', 'Die Karte ist sofort wieder online. Kunde: Verlängerungsbestätigung, du: „Verlängerung bestätigt“. Das alte Stripe-Abo wird automatisch beendet.']
					],
					notes: [
						'Kachel <b>Verlängerung nötig</b> auf der Übersicht: zeigt alle Kunden, deren Abo abgelaufen oder deaktiviert ist.',
						'Warnung „Altes Stripe-Abo nach Verlängerung bitte von Hand beenden“: in Stripe beim Kunden das alte Abo <b>sofort</b> kündigen, sonst wird doppelt abgebucht.'
					]
				},
				{
					id: 'upgrade', title: 'Upgrade auf einen höheren Tarif',
					lead: 'Der Kunde wechselt während des Jahres selbst in einen höheren Tarif, zum Beispiel von Start auf Pro.',
					flow: [
						['c', 'Tippt auf „Upgrade“', 'In SmartPilot™ (Karte „Ihr Paket“) oder über den Link in der Verlängerungs-Erinnerung. Die Seite zeigt den anteiligen Betrag für den Rest des Jahres.'],
						['a', 'Stripe bucht sofort ab', 'Anteiliger Preisunterschied über die gespeicherte Zahlungsart. Das Verlängerungsdatum bleibt, danach gilt der Jahrespreis des neuen Tarifs. Schlägt die Zahlung fehl, bleibt der alte Tarif.'],
						['a', 'Bestätigungen', 'Kunde: „Ihr Upgrade auf [Tarif]“. Du: „Tarif-Upgrade“.'],
						['y', 'Karte erweitern', 'Jetzt sind mehr Gerichte und Sprachen möglich: fehlende Sprachen übersetzen, neue Gerichte einpflegen, sobald der Kunde sie schickt.']
					],
					notes: [
						'Smart Discovery wird nicht hier upgegradet, sondern über den Upgrade-Link aus dem Discovery-Bericht.',
						'Warnung „Upgrade bezahlt, DB-Update fehlgeschlagen“ oder „Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig“: in Stripe nachsehen, welcher Tarif wirklich gilt, und ihn in Supabase (subscriptions → plan) angleichen.'
					]
				},
				{
					id: 'addons', title: 'Zusatzmodule nachbuchen',
					lead: 'Smart FoodMatch™, Smart WeeklyReport™ und Smart DishPhoto™ kann der Kunde jederzeit selbst nachbuchen.',
					flow: [
						['c', 'Öffnet „Zusatzmodule verwalten“', 'Link in der Bestellbestätigung, in der Verlängerungs-Erinnerung oder in SmartPilot™.'],
						['a', 'Stripe bucht ab', 'FoodMatch und WeeklyReport anteilig bis zum Jahresende, danach verlängern sie sich mit dem Tarif. DishPhoto einmalig.'],
						['a', 'Bestätigungen', 'Kunde: „[Modul] wurde hinzugefügt“. Du: „Add-on nachträglich gebucht“.'],
						['y', 'Modul einrichten', 'Im Tab Zusatzmodule prüfen, ob es aktiv ist, und es einrichten (FoodMatch-Fragen, Fotos).']
					],
					notes: [
						'Smart ServiceHub™ kann nicht über diese Seite nachgebucht werden, nur bei der Bestellung.',
						'Warnung „Add-on bezahlt, DB-Update fehlgeschlagen“: das Modul im Builder im Tab Zusatzmodule von Hand einschalten.'
					]
				},
				{
					id: 'servicehub', title: 'ServiceHub: Tische, Kassennummern & Personal',
					lead: 'Nur für Kunden mit Smart ServiceHub™ (Bestellen am Tisch).',
					flow: [
						['y', 'Link schicken', 'Tab Zusatzmodule → <b>Link für Tische & Kassennummern</b> kopieren und mit der Vorlage „ServiceHub: tables & till numbers link (manual)“ schicken.'],
						['c', 'Trägt Tische & Kassennummern ein', 'Sieht alle Gerichte mit Beschreibung und Preis und schreibt nur die Nummer aus seiner Kasse daneben, dazu seine Tische.'],
						['a', 'Eingang', 'Du: „Tische & Kassennummern eingegangen – [Name]“. Fehlende Tische werden sofort angelegt, die Kassennummern trägt der Builder beim nächsten Öffnen ein.'],
						['y', 'Personal-Links verteilen', '<b>Onboarding-Vorlage</b> (Tab Zusatzmodule) mit den Links und QR-Codes für Küche, Bar, Service und Kasse schicken. Jedes Gerät kann die Seite als App installieren und Push-Benachrichtigungen einschalten.']
					],
					notes: [
						'Jedem Gericht muss Küche oder Bar zugeordnet sein, sonst landen Bestellungen nicht richtig.',
						'Gerät verloren oder Mitarbeiter weg: den Personal-Link im Builder löschen. Alle Geräte mit diesem Link sind sofort gesperrt und bekommen keine Push-Nachrichten mehr.'
					]
				},
				{
					id: 'cancel', title: 'Kündigung',
					lead: 'Der Kunde kann jederzeit zum Ende des laufenden Jahres kündigen, formlos per E-Mail. Bereits Gezahltes wird nicht erstattet. Das Abo beendest du in Stripe, und zwar zum Ende der Laufzeit.',
					decision: [
						['ok', 'In Stripe wählen', 'Zum Ende der Laufzeit', 'Richtig. Die Karte bleibt bis zum Ende des bezahlten Jahres online, danach endet das Abo, es wird nichts mehr abgebucht.'],
						['bad', 'Nicht wählen', 'Sofort', 'Die Karte geht sofort offline, obwohl der Kunde das Jahr schon bezahlt hat.']
					],
					steps: [
						'Dem Kunden bestätigen: <i>„Ihre Kündigung ist eingegangen, Ihre Speisekarte bleibt bis zum [Datum] online.“</i> Das Datum steht in Stripe beim Abo unter „Current period“.',
						'<b>dashboard.stripe.com</b> öffnen. Oben muss der <b>Live-Modus</b> aktiv sein, nicht „Test mode“.',
						'<b>Customers</b> → den Kunden über seine E-Mail-Adresse suchen.',
						'Unter <b>Subscriptions</b> beim Abo rechts auf <b>⋯</b> → <b>Cancel subscription</b>.',
						'<b>At end of current period</b> wählen und mit <b>Cancel subscription</b> bestätigen.',
						'Kontrolle: beim Abo steht jetzt „Cancels [Datum]“. Fertig.'
					],
					timeline: [
						['Heute', 'y', 'Kündigung vorgemerkt', 'Im Builder und in SmartPilot™ ändert sich noch nichts.'],
						['Bis zum Laufzeitende', 'a', 'Alles läuft weiter', 'Karte, Zusatzmodule und QR-Code funktionieren wie bisher. Es kommt keine Verlängerungs-Erinnerung mehr.'],
						['Am Laufzeitende', 'a', 'Abo endet', 'Stripe meldet das Ende, die Karte geht automatisch offline, der WeeklyReport stoppt.']
					],
					notes: ['Im Einzelfall trotzdem erstatten: Stripe → <b>Payments</b> → die Zahlung → <b>Refund</b>.']
				},
				{
					id: 'delete', title: 'Kunde komplett löschen',
					lead: '„Kunde löschen“ im Builder entfernt nur die Speisekarte. Hatte der Kunde je ein Abo oder ServiceHub, blockiert die Datenbank das, bis die abhängigen Einträge weg sind.',
					decision: [
						['neutral', 'Kunde ohne Abo', 'Ein Klick', 'Im Builder <b>Kunde löschen</b> → bestätigen. Fertig.'],
						['ok', 'Kunde mit Abo oder ServiceHub', 'Drei Schritte', 'Erst in Stripe beenden, dann in Supabase aufräumen, dann im Builder löschen.']
					],
					steps: [
						'Läuft das Abo noch? Zuerst in Stripe kündigen (siehe <a href="#cancel">Kündigung</a>). Löschen in Supabase beendet <b>kein</b> Stripe-Abo, der Kunde würde weiter bezahlen.',
						'<b>Supabase → SQL Editor</b> öffnen, den Block unten einfügen, überall <b>SLUG</b> durch den Slug des Kunden ersetzen, <b>Run</b>.',
						'Im Builder den Kunden auswählen → <b>Kunde löschen</b> → bestätigen. Jetzt klappt es; SmartPilot™-Link, Push-Geräte und Kassennummern verschwinden automatisch mit.'
					],
					code: DELETE_SQL,
					notes: ['Nie bei El Greco ausführen: das ist der Demo-Kunde der Website (Live-Demo, „Website-Demo“-Zugänge).']
				},
				{
					id: 'emails', title: 'Alle automatischen Nachrichten',
					lead: 'Was automatisch verschickt wird. Jede E-Mail steht danach auch unter <b>Aktivität</b> im Builder. Kunden bekommen ihre Mails in der Sprache der Website, über die sie bestellt haben (DE, EN oder IT).',
					tables: [
						{
							title: 'An den Kunden', head: ['Betreff', 'Wann'],
							rows: [
								['Ihre Bestellung bei Smart Menu Solutions', 'Direkt nach der Zahlung eines Jahrestarifs, auch beim Upgrade von Smart Discovery'],
								['Willkommen bei Smart Discovery', 'Direkt nach dem Kauf von Smart Discovery'],
								['Smart Discovery – Ihre Testphase endet bald: Informationen zum Upgrade und Ihren Ergebnissen', 'Tag 6 von Smart Discovery'],
								['Ihr Test mit Smart Discovery ist abgelaufen', 'Tag 7 ohne Upgrade'],
								['Ihr Abo verlängert sich am [Datum]', '30 Tage vor der automatischen Verlängerung'],
								['Ihre Verlängerung bei Smart Menu Solutions', 'Nach einer erfolgreichen Verlängerung'],
								['Ihre Verlängerung ist fehlgeschlagen – bitte handeln', 'Abbuchung bei der Verlängerung fehlgeschlagen'],
								['Ihr Abo wurde deaktiviert', '7 Tage nach der fehlgeschlagenen Zahlung, Karte offline'],
								['Ihr Upgrade auf [Tarif]', 'Nach einem Tarif-Upgrade'],
								['[Modul] wurde hinzugefügt', 'Nach dem Nachbuchen eines Zusatzmoduls'],
								['Smart WeeklyReport™: [Name]', 'Jeden Montag früh, nur mit WeeklyReport']
							]
						},
						{
							title: 'An dich (Info)', head: ['Betreff', 'Bedeutung'],
							rows: [
								['Neue Bestellung eingegangen', 'Neuer Kunde (Jahrestarif oder Smart Discovery)'],
								['Dateien zur Bestellung eingegangen / erneut hochgeladen', 'Speisekarte, Logo und Fotos sind da, du kannst loslegen'],
								['Neue Speisekarte zur Verlängerung / Verlängerung: keine neue Speisekarte', 'Kunde hat über den Zahlungslink verlängert'],
								['Smart-Discovery-Bericht verschickt', 'Tag 6 eines Tests'],
								['Smart Discovery abgelaufen (kein Upgrade)', 'Test vorbei, Karte offline'],
								['Upgrade von Smart Discovery', 'Test-Kunde hat einen Jahrestarif gekauft: Karte auf vollen Umfang erweitern'],
								['Automatische Verlängerung erfolgreich', 'Alles gut'],
								['Automatische Verlängerung fehlgeschlagen', 'Kunde hat den Zahlungslink bekommen, 7 Tage Frist'],
								['Abo automatisch deaktiviert', 'Karte offline, Kunde hat nicht bezahlt'],
								['Verlängerung bestätigt', 'Kunde hat über den Zahlungslink bezahlt, Karte wieder online'],
								['Tarif-Upgrade', 'Kunde hat upgegradet: Karte erweitern'],
								['Add-on nachträglich gebucht', 'Modul einrichten'],
								['Tische & Kassennummern eingegangen – [Name]', 'ServiceHub-Daten vom Kunden sind da'],
								['Neue Kontaktanfrage (DE/EN/IT) – [Name]', 'Kontaktformular der Website: antworten']
							]
						},
						{
							title: 'Warnungen: hier musst du handeln', warn: true, head: ['Betreff', 'Was tun'],
							rows: [
								['Altes Stripe-Abo nach Verlängerung bitte von Hand beenden', 'In Stripe das alte Abo sofort kündigen'],
								['Add-on bezahlt, DB-Update fehlgeschlagen', 'Modul im Builder von Hand einschalten'],
								['Upgrade bezahlt, DB-Update fehlgeschlagen', 'Tarif in Supabase an Stripe angleichen'],
								['Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig', 'In Stripe prüfen, welcher Tarif gilt, und angleichen']
							]
						}
					],
					notes: ['Steht unter Aktivität „Kundenbestätigung übersprungen (ungültige E-Mail)“, hat der Kunde eine falsche E-Mail angegeben. Ihn über Telefon oder WhatsApp erreichen.']
				},
				{
					id: 'where', title: 'Wo sehe ich was?',
					list: [
						'<b>Dein Postfach</b>: alle Meldungen und Warnungen an dich.',
						'<b>Aktivität</b> (Builder): die letzten 50 verschickten E-Mails mit Empfänger.',
						'<b>Übersicht → Verlängerung nötig</b>: Kunden mit abgelaufenem oder deaktiviertem Abo.',
						'<b>Kunde → Zusatzmodule</b>: gebuchte Module, Stand von Smart Discovery („Tag X von 7“), Schalter „Speisekarte online“.',
						'<b>Stripe</b>: Zahlungen, Abos, Kündigungen, Erstattungen.',
						'<b>SmartPilot™</b>: was der Kunde sieht, also Paket, Upgrade/Verlängern, QR-Code und Statistik.'
					]
				},
				{
					id: 'faq', title: 'Häufige Fälle',
					qa: [
						['Der Kunde hat nichts hochgeladen.', 'Der Upload-Link steht in seiner Bestellbestätigung. Oder er schickt die Karte per E-Mail.'],
						['Der Kunde will etwas an der Karte ändern.', 'Er schickt die Änderung, wir ändern sie im Builder und speichern. Die Karte ist sofort aktuell, der QR-Code bleibt gleich.'],
						['Der Kunde sagt, die Karte ist offline.', 'Kunde auswählen. Steht oben „Abgelaufen“ oder „Deaktiviert“: den Verlängerungs-Link schicken. Sonst im Tab Zusatzmodule prüfen, ob „Speisekarte online“ an ist.'],
						['Smart Discovery startet nicht.', '„Speisekarte online“ muss an sein. Die 7 Tage starten mit dem nächsten Lauf früh morgens.'],
						['Der Kunde will mehr Gerichte oder Sprachen.', 'Upgrade über SmartPilot™ (Knopf „Upgrade“).'],
						['Doppelt abgebucht?', 'In Stripe beim Kunden nachsehen, ob zwei Abos aktiv sind. Das alte sofort kündigen und die doppelte Zahlung erstatten.']
					]
				}
			]
		},
		en: {
			eyebrow: 'User guide',
			title: 'From order to renewal',
			intro: 'Everything that happens around a customer: what the customer does, what runs automatically and what you do in the builder. The yearly cycle at the top, every flow in detail below.',
			legend: { c: 'Customer', a: 'Automatic', y: 'You' },
			toc: 'Contents',
			overview: {
				title: 'A customer’s yearly cycle',
				order: 'Order\n& payment', setup: 'Setup in\nthe builder', online: 'Online,\nQR code sent', year: 'The year\nruns',
				remind: 'Reminder\n30 days before', renew: 'Automatic\nrenewal', ok: 'paid: runs for another year',
				fail: 'Payment\nfailed', grace: '7 days grace\nwith payment link', off: 'Offline\n(deactivated)', back: 'payment link paid: back online at once'
			},
			sections: [
				{
					id: 'order', title: 'New order (yearly plan)',
					lead: 'Smart Start, Smart Pro or Smart Premium, with add-ons if wanted. From payment to setup everything runs automatically.',
					flow: [
						['c', 'Orders on the website', 'Picks a plan and add-ons, confirms “I am ordering as a business” and pays through Stripe.'],
						['a', 'Confirmation & new client', 'Customer: “Your order at Smart Menu Solutions” with the upload link and the add-ons link. You: “Neue Bestellung eingegangen”. The client shows up under <b>Clients</b> in the builder, still offline.'],
						['c', 'Uploads the menu', 'Right after paying: a PDF or up to 10 photos (combined into one PDF), logo, photo archive. Later through the link in the confirmation.'],
						['a', 'Files to you', 'Email “Dateien zur Bestellung eingegangen” with the files. Large files come as a download link (valid for 30 days).'],
						['y', 'Set up the menu', 'In the builder, see <a href="#setup">Setting up the menu</a>.'],
						['y', 'Go online & deliver', 'Switch the menu online, send the QR code and the SmartPilot™ link with the templates.']
					],
					notes: [
						'No files arrived? The upload link is in the customer’s order confirmation. They can also simply email the menu to info@smartmenusolutions.com.',
						'There is no refund once the order confirmation has been sent. We sell to businesses only (terms of service).'
					]
				},
				{
					id: 'discovery', title: 'Smart Discovery (7 days for €2.99)',
					lead: 'A one-off purchase to try us, not a subscription: up to 10 dishes and every add-on to try. The 7 days start when the menu goes online, not at purchase.',
					timeline: [
						['Purchase', 'c', 'Customer pays €2.99', 'Automatically: “Welcome to Smart Discovery” with the upload link and the stats link. You: “Neue Bestellung eingegangen”.'],
						['Setup', 'y', 'You set up the menu', 'Up to 10 dishes. Then switch on “Menu online” in the <b>Add-ons</b> tab and send the QR code.'],
						['Day 1', 'a', 'The 7 days start', 'With the next daily run (early morning) after going online. The Add-ons tab shows “Day X of 7” at the top.'],
						['Day 6', 'a', 'Report to the customer', '“Smart Discovery – Your trial ends soon: …” with views, the most popular dishes and the upgrade link. You: “Smart-Discovery-Bericht verschickt”.'],
						['Day 7', 'a', 'No upgrade: offline', 'The menu goes offline. Customer: “Your Smart Discovery trial has ended”. You: “Smart Discovery abgelaufen (kein Upgrade)”.'],
						['Upgrade', 'c', 'Customer picks a yearly plan', 'Through the upgrade link in the report or “Send link” in the Add-ons tab. The €2.99 is credited, the menu stays or comes back online. Customer: order confirmation. You: “Upgrade von Smart Discovery”.']
					],
					notes: ['After the upgrade only the add-ons the customer pays for in it stay on. The others from the trial switch off.']
				},
				{
					id: 'setup', title: 'Setting up the menu in the builder',
					lead: 'The checklist for every new menu. We set up everything and make every change; the customer never edits anything.',
					steps: [
						'<b>Clients</b>: select the client. New orders are already in the list.',
						'<b>Details</b>: check name, address, phone, WhatsApp and logo.',
						'<b>Menu & Photos</b>: “Import menu PDF or photo” → <b>Import</b>. Check the result: a price of <b>0.00</b> was unreadable on the photo, enter it by hand. Add photos.',
						'<b>Languages</b>: check the source language, tick the languages of the plan (Start 1+1, Pro 1+3, Premium 1+6), then <b>Automatically translate</b>.',
						'<b>Add-ons</b>: check the booked add-ons. With ServiceHub see <a href="#servicehub">ServiceHub</a>.',
						'<b>Add-ons → Menu online</b>: switch it on when the menu is finished. For Smart Discovery this starts the 7 days. Save.',
						'Right-hand column: <b>Download QR</b>, <b>Print table cards</b> if needed, then <b>Copy owner app link</b> (the SmartPilot™ link).',
						'<b>Email templates</b>: copy “Finished menu: QR code delivery (manual)” and “SmartPilot™: app link (manual)” in the customer’s language and send them.'
					],
					notes: [
						'The customer sends changes by email or WhatsApp, we change the menu and save. The QR code always stays the same.',
						'Never write “you can change it yourself” in a customer text.',
						'Always test with El Greco.'
					]
				},
				{
					id: 'renewal', title: 'Renewal (automatic every year)',
					lead: 'Yearly plans renew automatically through Stripe. You only step in when a warning arrives or a customer doesn’t pay.',
					timeline: [
						['30 days before', 'a', 'Reminder', 'Customer: “Your subscription renews on [date]” with the amount and links for upgrade and add-ons. Cancelled plans get none.'],
						['Renewal day', 'a', 'Stripe charges', 'If it works: customer “Your renewal at Smart Menu Solutions” (with a link for a new menu), you “Automatische Verlängerung erfolgreich”. Done.'],
						['If it fails', 'a', 'Payment failed', 'Customer: “Your renewal has failed – action needed” with a payment link. You: “Automatische Verlängerung fehlgeschlagen”. The menu stays online for 7 more days.'],
						['7 days later', 'a', 'Deactivated', 'Without payment the menu goes offline. Customer: “Your subscription has been deactivated” (with the payment link). You: “Abo automatisch deaktiviert”. In the builder the client is locked and shows the renewal link at the top.'],
						['After that', 'c', 'Customer pays through the link', 'The menu is back online at once. Customer: renewal confirmation, you: “Verlängerung bestätigt”. The old Stripe subscription is ended automatically.']
					],
					notes: [
						'The <b>Needs renewal</b> tile on the Overview lists every client whose plan has expired or been deactivated.',
						'Warning “Altes Stripe-Abo nach Verlängerung bitte von Hand beenden”: cancel the old subscription in Stripe <b>immediately</b>, or the customer is charged twice.'
					]
				},
				{
					id: 'upgrade', title: 'Upgrade to a higher plan',
					lead: 'The customer moves to a higher plan during the year on their own, for example from Start to Pro.',
					flow: [
						['c', 'Taps “Upgrade”', 'In SmartPilot™ (the “Your plan” card) or through the link in the renewal reminder. The page shows the prorated amount for the rest of the year.'],
						['a', 'Stripe charges at once', 'The prorated price difference on the saved payment method. The renewal date stays; after that the new plan’s yearly price applies. If the payment fails, the old plan stays.'],
						['a', 'Confirmations', 'Customer: “Your upgrade to [plan]”. You: “Tarif-Upgrade”.'],
						['y', 'Extend the menu', 'More dishes and languages are now possible: translate the missing languages, add new dishes as soon as the customer sends them.']
					],
					notes: [
						'Smart Discovery is not upgraded here but through the upgrade link in the Discovery report.',
						'Warning “Upgrade bezahlt, DB-Update fehlgeschlagen” or “Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig”: check in Stripe which plan really applies and match it in Supabase (subscriptions → plan).'
					]
				},
				{
					id: 'addons', title: 'Adding add-ons later',
					lead: 'The customer can add Smart FoodMatch™, Smart WeeklyReport™ and Smart DishPhoto™ on their own at any time.',
					flow: [
						['c', 'Opens “Manage add-ons”', 'Link in the order confirmation, the renewal reminder or SmartPilot™.'],
						['a', 'Stripe charges', 'FoodMatch and WeeklyReport prorated to the end of the year, then they renew with the plan. DishPhoto once.'],
						['a', 'Confirmations', 'Customer: “[Add-on] has been added”. You: “Add-on nachträglich gebucht”.'],
						['y', 'Set up the add-on', 'Check in the Add-ons tab that it is on and set it up (FoodMatch questions, photos).']
					],
					notes: [
						'Smart ServiceHub™ cannot be added on this page, only when ordering.',
						'Warning “Add-on bezahlt, DB-Update fehlgeschlagen”: switch the add-on on by hand in the builder’s Add-ons tab.'
					]
				},
				{
					id: 'servicehub', title: 'ServiceHub: tables, till numbers & staff',
					lead: 'Only for customers with Smart ServiceHub™ (ordering at the table).',
					flow: [
						['y', 'Send the link', 'Add-ons tab → copy the <b>Link for tables & till numbers</b> and send it with the template “ServiceHub: tables & till numbers link (manual)”.'],
						['c', 'Enters tables & till numbers', 'Sees every dish with description and price and only writes the number from their till next to it, plus their tables.'],
						['a', 'Received', 'You: “Tische & Kassennummern eingegangen – [name]”. Missing tables are created at once; the builder fills in the till numbers the next time it opens.'],
						['y', 'Hand out the staff links', 'Send the <b>Onboarding template</b> (Add-ons tab) with the links and QR codes for kitchen, bar, service and cashier. Every device can install the page as an app and switch on push notifications.']
					],
					notes: [
						'Every dish must be assigned to kitchen or bar, or orders end up in the wrong place.',
						'Device lost or employee gone: delete the staff link in the builder. Every device using it is locked out at once and gets no more push notifications.'
					]
				},
				{
					id: 'cancel', title: 'Cancellation',
					lead: 'The customer can cancel at any time with effect from the end of the current year, simply by email. Payments already made are not refunded. You end the subscription in Stripe, at the end of the period.',
					decision: [
						['ok', 'Choose in Stripe', 'At end of period', 'Correct. The menu stays online until the end of the paid year; then the subscription ends and nothing more is charged.'],
						['bad', 'Do not choose', 'Immediately', 'The menu goes offline at once, although the customer has paid for the year.']
					],
					steps: [
						'Confirm to the customer: <i>“We have received your cancellation, your menu stays online until [date].”</i> The date is shown in Stripe on the subscription as “Current period”.',
						'Open <b>dashboard.stripe.com</b>. <b>Live mode</b> must be on at the top, not “Test mode”.',
						'<b>Customers</b> → search for the customer by email address.',
						'Under <b>Subscriptions</b>, click <b>⋯</b> next to the subscription → <b>Cancel subscription</b>.',
						'Choose <b>At end of current period</b> and confirm with <b>Cancel subscription</b>.',
						'Check: the subscription now shows “Cancels [date]”. Done.'
					],
					timeline: [
						['Today', 'y', 'Cancellation scheduled', 'Nothing changes in the builder or in SmartPilot™ yet.'],
						['Until the period ends', 'a', 'Everything keeps running', 'Menu, add-ons and QR code work as before. No more renewal reminder.'],
						['At the end of the period', 'a', 'Subscription ends', 'Stripe reports the end, the menu goes offline automatically, the WeeklyReport stops.']
					],
					notes: ['Refund in a single case anyway: Stripe → <b>Payments</b> → the payment → <b>Refund</b>.']
				},
				{
					id: 'delete', title: 'Deleting a client completely',
					lead: '“Delete client” in the builder only removes the menu. If the client ever had a subscription or ServiceHub, the database blocks it until the dependent rows are gone.',
					decision: [
						['neutral', 'Client without a subscription', 'One click', '<b>Delete client</b> in the builder → confirm. Done.'],
						['ok', 'Client with a subscription or ServiceHub', 'Three steps', 'End it in Stripe first, then clean up in Supabase, then delete in the builder.']
					],
					steps: [
						'Is the subscription still running? Cancel it in Stripe first (see <a href="#cancel">Cancellation</a>). Deleting in Supabase does <b>not</b> end a Stripe subscription; the customer would keep paying.',
						'Open <b>Supabase → SQL Editor</b>, paste the block below, replace every <b>SLUG</b> with the client’s slug, <b>Run</b>.',
						'Select the client in the builder → <b>Delete client</b> → confirm. Now it works; the SmartPilot™ link, push devices and till numbers go with it automatically.'
					],
					code: DELETE_SQL,
					notes: ['Never run it for El Greco: it is the website’s demo client (live demo, “Website-Demo” staff access).']
				},
				{
					id: 'emails', title: 'Every automatic message',
					lead: 'What goes out automatically. Every email then also shows under <b>Activity</b> in the builder. Customers get their emails in the language of the website they ordered on (DE, EN or IT); the messages to you are always in German.',
					tables: [
						{
							title: 'To the customer', head: ['Subject', 'When'],
							rows: [
								['Your order at Smart Menu Solutions', 'Right after paying for a yearly plan, also on an upgrade from Smart Discovery'],
								['Welcome to Smart Discovery', 'Right after buying Smart Discovery'],
								['… guests opened your menu – your Smart Discovery report', 'Day 6 of Smart Discovery'],
								['Your Smart Discovery trial has ended', 'Day 7 without an upgrade'],
								['Your subscription renews on [date]', '30 days before the automatic renewal'],
								['Your renewal at Smart Menu Solutions', 'After a successful renewal'],
								['Your renewal has failed – action needed', 'The renewal charge failed'],
								['Your subscription has been deactivated', '7 days after the failed payment, menu offline'],
								['Your upgrade to [plan]', 'After a plan upgrade'],
								['[Add-on] has been added', 'After adding an add-on'],
								['Smart WeeklyReport™: [name]', 'Every Monday morning, with WeeklyReport only']
							]
						},
						{
							title: 'To you (info)', head: ['Subject', 'Meaning'],
							rows: [
								['Neue Bestellung eingegangen', 'New client (yearly plan or Smart Discovery)'],
								['Dateien zur Bestellung eingegangen / erneut hochgeladen', 'Menu, logo and photos have arrived, you can start'],
								['Neue Speisekarte zur Verlängerung / Verlängerung: keine neue Speisekarte', 'Customer renewed through the payment link'],
								['Smart-Discovery-Bericht verschickt', 'Day 6 of a trial'],
								['Smart Discovery abgelaufen (kein Upgrade)', 'Trial over, menu offline'],
								['Upgrade von Smart Discovery', 'Trial customer bought a yearly plan: extend the menu to the full plan'],
								['Automatische Verlängerung erfolgreich', 'All good'],
								['Automatische Verlängerung fehlgeschlagen', 'Customer got the payment link, 7 days grace'],
								['Abo automatisch deaktiviert', 'Menu offline, customer didn’t pay'],
								['Verlängerung bestätigt', 'Customer paid through the payment link, menu back online'],
								['Tarif-Upgrade', 'Customer upgraded: extend the menu'],
								['Add-on nachträglich gebucht', 'Set up the add-on'],
								['Tische & Kassennummern eingegangen – [name]', 'The customer’s ServiceHub data has arrived'],
								['Neue Kontaktanfrage (DE/EN/IT) – [name]', 'Website contact form: reply']
							]
						},
						{
							title: 'Warnings: you have to act', warn: true, head: ['Subject', 'What to do'],
							rows: [
								['Altes Stripe-Abo nach Verlängerung bitte von Hand beenden', 'Cancel the old subscription in Stripe immediately'],
								['Add-on bezahlt, DB-Update fehlgeschlagen', 'Switch the add-on on by hand in the builder'],
								['Upgrade bezahlt, DB-Update fehlgeschlagen', 'Match the plan in Supabase to Stripe'],
								['Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig', 'Check in Stripe which plan applies and match it']
							]
						}
					],
					notes: ['If Activity shows “Kundenbestätigung übersprungen (ungültige E-Mail)”, the customer entered a wrong email address. Reach them by phone or WhatsApp.']
				},
				{
					id: 'where', title: 'Where do I see what?',
					list: [
						'<b>Your inbox</b>: every message and warning to you.',
						'<b>Activity</b> (builder): the last 50 emails sent, with recipient.',
						'<b>Overview → Needs renewal</b>: clients with an expired or deactivated plan.',
						'<b>Client → Add-ons</b>: booked add-ons, Smart Discovery status (“Day X of 7”), the “Menu online” switch.',
						'<b>Stripe</b>: payments, subscriptions, cancellations, refunds.',
						'<b>SmartPilot™</b>: what the customer sees: plan, upgrade/renew, QR code and stats.'
					]
				},
				{
					id: 'faq', title: 'Common cases',
					qa: [
						['The customer hasn’t uploaded anything.', 'The upload link is in their order confirmation. Or they send the menu by email.'],
						['The customer wants something changed on the menu.', 'They send the change, we change it in the builder and save. The menu is up to date at once, the QR code stays the same.'],
						['The customer says the menu is offline.', 'Select the client. If the top says “Expired” or “Deactivated”: send the renewal link. Otherwise check in the Add-ons tab that “Menu online” is on.'],
						['Smart Discovery doesn’t start.', '“Menu online” must be on. The 7 days start with the next run early in the morning.'],
						['The customer wants more dishes or languages.', 'Upgrade through SmartPilot™ (“Upgrade” button).'],
						['Charged twice?', 'Check in Stripe whether the customer has two active subscriptions. Cancel the old one immediately and refund the double payment.']
					]
				}
			]
		},
		el: {
			eyebrow: 'Οδηγός χρήσης',
			title: 'Από την παραγγελία έως την ανανέωση',
			intro: 'Όλα όσα συμβαίνουν γύρω από έναν πελάτη: τι κάνει ο πελάτης, τι γίνεται αυτόματα και τι κάνεις εσύ στον builder. Πάνω ο ετήσιος κύκλος, από κάτω κάθε διαδικασία αναλυτικά.',
			legend: { c: 'Πελάτης', a: 'Αυτόματα', y: 'Εσύ' },
			toc: 'Περιεχόμενα',
			overview: {
				title: 'Ο ετήσιος κύκλος ενός πελάτη',
				order: 'Παραγγελία\n& πληρωμή', setup: 'Στήσιμο\nστον builder', online: 'Online,\nαποστολή QR', year: 'Ο χρόνος\nτρέχει',
				remind: 'Υπενθύμιση\n30 ημέρες πριν', renew: 'Αυτόματη\nανανέωση', ok: 'πληρώθηκε: συνεχίζει άλλον έναν χρόνο',
				fail: 'Αποτυχία\nπληρωμής', grace: '7 ημέρες\nπροθεσμία πληρωμής', off: 'Offline\n(απενεργοποίηση)', back: 'πληρωμή μέσω συνδέσμου: αμέσως ξανά online'
			},
			sections: [
				{
					id: 'order', title: 'Νέα παραγγελία (ετήσιο πακέτο)',
					lead: 'Smart Start, Smart Pro ή Smart Premium, με πρόσθετα αν θέλει. Από την πληρωμή έως το στήσιμο όλα γίνονται αυτόματα.',
					flow: [
						['c', 'Παραγγέλνει στο site', 'Διαλέγει πακέτο και πρόσθετα, επιβεβαιώνει «Παραγγέλνω ως επιχείρηση» και πληρώνει μέσω Stripe.'],
						['a', 'Επιβεβαίωση & νέος πελάτης', 'Πελάτης: email επιβεβαίωσης παραγγελίας με σύνδεσμο ανεβάσματος και σύνδεσμο για πρόσθετα. Εσύ: «Neue Bestellung eingegangen». Στον builder ο πελάτης εμφανίζεται στους <b>Πελάτες</b>, ακόμη offline.'],
						['c', 'Ανεβάζει το μενού', 'Αμέσως μετά την πληρωμή: PDF ή έως 10 φωτογραφίες (γίνονται ένα PDF), λογότυπο, αρχείο φωτογραφιών. Αργότερα μέσω του συνδέσμου στην επιβεβαίωση.'],
						['a', 'Αρχεία σε σένα', 'Email «Dateien zur Bestellung eingegangen» με τα αρχεία. Τα μεγάλα αρχεία έρχονται ως σύνδεσμος λήψης (ισχύει 30 ημέρες).'],
						['y', 'Στήσιμο του μενού', 'Στον builder, δες <a href="#setup">Στήσιμο του μενού</a>.'],
						['y', 'Online & παράδοση', 'Βάλε το μενού online, στείλε τον κωδικό QR και τον σύνδεσμο SmartPilot™ με τα πρότυπα.']
					],
					notes: [
						'Δεν ήρθαν αρχεία; Ο σύνδεσμος ανεβάσματος βρίσκεται στην επιβεβαίωση παραγγελίας του πελάτη. Μπορεί επίσης απλώς να στείλει το μενού στο info@smartmenusolutions.com.',
						'Μετά την επιβεβαίωση παραγγελίας δεν γίνεται επιστροφή χρημάτων. Πουλάμε μόνο σε επιχειρήσεις (όροι χρήσης).'
					]
				},
				{
					id: 'discovery', title: 'Smart Discovery (7 ημέρες για 2,99 €)',
					lead: 'Εφάπαξ αγορά για δοκιμή, όχι συνδρομή: έως 10 πιάτα και όλα τα πρόσθετα για δοκιμή. Οι 7 ημέρες ξεκινούν όταν το μενού βγει online, όχι με την αγορά.',
					timeline: [
						['Αγορά', 'c', 'Ο πελάτης πληρώνει 2,99 €', 'Αυτόματα: email καλωσορίσματος στο Smart Discovery με σύνδεσμο ανεβάσματος και σύνδεσμο στατιστικών. Εσύ: «Neue Bestellung eingegangen».'],
						['Στήσιμο', 'y', 'Στήνεις το μενού', 'Έως 10 πιάτα. Μετά ενεργοποίησε το «Μενού online» στην καρτέλα <b>Πρόσθετα</b> και στείλε τον κωδικό QR.'],
						['Ημέρα 1', 'a', 'Ξεκινούν οι 7 ημέρες', 'Με την επόμενη ημερήσια εκτέλεση (νωρίς το πρωί) μετά το online. Στην καρτέλα Πρόσθετα φαίνεται πάνω «Ημέρα X από 7».'],
						['Ημέρα 6', 'a', 'Αναφορά στον πελάτη', 'Email με τις προβολές, τα πιο δημοφιλή πιάτα και τον σύνδεσμο αναβάθμισης. Εσύ: «Smart-Discovery-Bericht verschickt».'],
						['Ημέρα 7', 'a', 'Χωρίς αναβάθμιση: offline', 'Το μενού βγαίνει offline. Πελάτης: email λήξης της δοκιμής. Εσύ: «Smart Discovery abgelaufen (kein Upgrade)».'],
						['Αναβάθμιση', 'c', 'Ο πελάτης διαλέγει ετήσιο πακέτο', 'Μέσω του συνδέσμου αναβάθμισης στην αναφορά ή «Αποστολή συνδέσμου» στην καρτέλα Πρόσθετα. Τα 2,99 € συμψηφίζονται, το μενού μένει ή ξαναβγαίνει online. Πελάτης: επιβεβαίωση παραγγελίας. Εσύ: «Upgrade von Smart Discovery».']
					],
					notes: ['Μετά την αναβάθμιση μένουν ενεργά μόνο τα πρόσθετα που πληρώνει ο πελάτης σε αυτήν. Τα υπόλοιπα της δοκιμής απενεργοποιούνται.']
				},
				{
					id: 'setup', title: 'Στήσιμο του μενού στον builder',
					lead: 'Η λίστα ελέγχου για κάθε νέο μενού. Εμείς στήνουμε τα πάντα και κάνουμε κάθε αλλαγή· ο πελάτης δεν αλλάζει ποτέ τίποτα μόνος του.',
					steps: [
						'<b>Πελάτες</b>: επίλεξε τον πελάτη. Οι νέες παραγγελίες είναι ήδη στη λίστα.',
						'<b>Στοιχεία</b>: έλεγξε όνομα, διεύθυνση, τηλέφωνο, WhatsApp και λογότυπο.',
						'<b>Μενού & φωτογραφίες</b>: «Εισαγωγή μενού από PDF ή φωτογραφία» → <b>Εισαγωγή</b>. Έλεγξε το αποτέλεσμα: τιμή <b>0,00</b> σημαίνει ότι δεν διαβαζόταν στη φωτογραφία, συμπλήρωσέ την με το χέρι. Πρόσθεσε φωτογραφίες.',
						'<b>Γλώσσες</b>: έλεγξε τη γλώσσα πηγής, τσέκαρε τις γλώσσες του πακέτου (Start 1+1, Pro 1+3, Premium 1+6) και μετά <b>Αυτόματη μετάφραση</b>.',
						'<b>Πρόσθετα</b>: έλεγξε τα πρόσθετα που έχουν κλειστεί. Με ServiceHub δες <a href="#servicehub">ServiceHub</a>.',
						'<b>Πρόσθετα → Μενού online</b>: ενεργοποίησέ το όταν το μενού είναι έτοιμο. Στο Smart Discovery έτσι ξεκινούν οι 7 ημέρες. Αποθήκευση.',
						'Δεξιά στήλη: <b>Λήψη QR</b>, αν χρειάζεται <b>Εκτύπωση καρτών τραπεζιού</b>, μετά <b>Αντιγραφή συνδέσμου εφαρμογής ιδιοκτήτη</b> (ο σύνδεσμος SmartPilot™).',
						'<b>Πρότυπα email</b>: αντίγραψε το «Finished menu: QR code delivery (manual)» και το «SmartPilot™: app link (manual)» στη γλώσσα του πελάτη και στείλ’ τα.'
					],
					notes: [
						'Ο πελάτης στέλνει τις αλλαγές με email ή WhatsApp, εμείς αλλάζουμε το μενού και αποθηκεύουμε. Ο κωδικός QR μένει πάντα ίδιος.',
						'Ποτέ μη γράφεις σε κείμενο για πελάτη «μπορείτε να το αλλάξετε μόνοι σας».',
						'Δοκιμές πάντα με το El Greco.'
					]
				},
				{
					id: 'renewal', title: 'Ανανέωση (αυτόματα κάθε χρόνο)',
					lead: 'Τα ετήσια πακέτα ανανεώνονται αυτόματα μέσω Stripe. Παρεμβαίνεις μόνο όταν έρθει προειδοποίηση ή όταν ένας πελάτης δεν πληρώσει.',
					timeline: [
						['30 ημέρες πριν', 'a', 'Υπενθύμιση', 'Πελάτης: email ότι η συνδρομή ανανεώνεται στις [ημερομηνία], με το ποσό και συνδέσμους για αναβάθμιση και πρόσθετα. Οι ακυρωμένες συνδρομές δεν παίρνουν.'],
						['Ημέρα ανανέωσης', 'a', 'Χρέωση από το Stripe', 'Αν πετύχει: ο πελάτης παίρνει επιβεβαίωση ανανέωσης (με σύνδεσμο για νέο μενού), εσύ «Automatische Verlängerung erfolgreich». Τέλος.'],
						['Αν αποτύχει', 'a', 'Αποτυχία πληρωμής', 'Πελάτης: email αποτυχίας ανανέωσης με σύνδεσμο πληρωμής. Εσύ: «Automatische Verlängerung fehlgeschlagen». Το μενού μένει online άλλες 7 ημέρες.'],
						['7 ημέρες μετά', 'a', 'Απενεργοποίηση', 'Χωρίς πληρωμή το μενού βγαίνει offline. Πελάτης: email απενεργοποίησης (με σύνδεσμο πληρωμής). Εσύ: «Abo automatisch deaktiviert». Στον builder ο πελάτης κλειδώνεται και πάνω φαίνεται ο σύνδεσμος ανανέωσης.'],
						['Μετά', 'c', 'Ο πελάτης πληρώνει μέσω συνδέσμου', 'Το μενού είναι αμέσως ξανά online. Πελάτης: επιβεβαίωση ανανέωσης, εσύ: «Verlängerung bestätigt». Η παλιά συνδρομή Stripe τερματίζεται αυτόματα.']
					],
					notes: [
						'Η κάρτα <b>Χρειάζονται ανανέωση</b> στην Επισκόπηση δείχνει όλους τους πελάτες με ληγμένη ή απενεργοποιημένη συνδρομή.',
						'Προειδοποίηση «Altes Stripe-Abo nach Verlängerung bitte von Hand beenden»: ακύρωσε την παλιά συνδρομή στο Stripe <b>αμέσως</b>, αλλιώς ο πελάτης χρεώνεται διπλά.'
					]
				},
				{
					id: 'upgrade', title: 'Αναβάθμιση σε μεγαλύτερο πακέτο',
					lead: 'Ο πελάτης περνά μόνος του σε μεγαλύτερο πακέτο μέσα στη χρονιά, π.χ. από Start σε Pro.',
					flow: [
						['c', 'Πατάει «Αναβάθμιση»', 'Στο SmartPilot™ (κάρτα «Το πακέτο σας») ή μέσω του συνδέσμου στην υπενθύμιση ανανέωσης. Η σελίδα δείχνει το αναλογικό ποσό για το υπόλοιπο της χρονιάς.'],
						['a', 'Το Stripe χρεώνει αμέσως', 'Η αναλογική διαφορά τιμής στον αποθηκευμένο τρόπο πληρωμής. Η ημερομηνία ανανέωσης μένει ίδια· μετά ισχύει η ετήσια τιμή του νέου πακέτου. Αν αποτύχει η πληρωμή, μένει το παλιό πακέτο.'],
						['a', 'Επιβεβαιώσεις', 'Πελάτης: email αναβάθμισης. Εσύ: «Tarif-Upgrade».'],
						['y', 'Επέκταση του μενού', 'Τώρα επιτρέπονται περισσότερα πιάτα και γλώσσες: μετάφρασε τις γλώσσες που λείπουν, πρόσθεσε νέα πιάτα μόλις τα στείλει ο πελάτης.']
					],
					notes: [
						'Το Smart Discovery δεν αναβαθμίζεται εδώ αλλά μέσω του συνδέσμου αναβάθμισης στην αναφορά Discovery.',
						'Προειδοποίηση «Upgrade bezahlt, DB-Update fehlgeschlagen» ή «Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig»: δες στο Stripe ποιο πακέτο ισχύει πραγματικά και προσάρμοσέ το στο Supabase (subscriptions → plan).'
					]
				},
				{
					id: 'addons', title: 'Προσθήκη πρόσθετων αργότερα',
					lead: 'Ο πελάτης μπορεί να προσθέσει μόνος του Smart FoodMatch™, Smart WeeklyReport™ και Smart DishPhoto™ οποιαδήποτε στιγμή.',
					flow: [
						['c', 'Ανοίγει «Διαχείριση πρόσθετων»', 'Σύνδεσμος στην επιβεβαίωση παραγγελίας, στην υπενθύμιση ανανέωσης ή στο SmartPilot™.'],
						['a', 'Χρέωση από το Stripe', 'FoodMatch και WeeklyReport αναλογικά έως το τέλος της χρονιάς, μετά ανανεώνονται μαζί με το πακέτο. DishPhoto εφάπαξ.'],
						['a', 'Επιβεβαιώσεις', 'Πελάτης: email ότι προστέθηκε το πρόσθετο. Εσύ: «Add-on nachträglich gebucht».'],
						['y', 'Ρύθμιση του πρόσθετου', 'Έλεγξε στην καρτέλα Πρόσθετα ότι είναι ενεργό και ρύθμισέ το (ερωτήσεις FoodMatch, φωτογραφίες).']
					],
					notes: [
						'Το Smart ServiceHub™ δεν προστίθεται από αυτή τη σελίδα, μόνο με την παραγγελία.',
						'Προειδοποίηση «Add-on bezahlt, DB-Update fehlgeschlagen»: ενεργοποίησε το πρόσθετο με το χέρι στην καρτέλα Πρόσθετα του builder.'
					]
				},
				{
					id: 'servicehub', title: 'ServiceHub: τραπέζια, κωδικοί ταμείου & προσωπικό',
					lead: 'Μόνο για πελάτες με Smart ServiceHub™ (παραγγελία στο τραπέζι).',
					flow: [
						['y', 'Στείλε τον σύνδεσμο', 'Καρτέλα Πρόσθετα → αντίγραψε τον <b>Σύνδεσμο για τραπέζια & κωδικούς ταμείου</b> και στείλ’ τον με το πρότυπο «ServiceHub: tables & till numbers link (manual)».'],
						['c', 'Συμπληρώνει τραπέζια & κωδικούς', 'Βλέπει όλα τα πιάτα με περιγραφή και τιμή και γράφει μόνο τον κωδικό από το ταμείο του δίπλα, μαζί με τα τραπέζια του.'],
						['a', 'Παραλαβή', 'Εσύ: «Tische & Kassennummern eingegangen – [όνομα]». Τα τραπέζια που λείπουν δημιουργούνται αμέσως· τους κωδικούς ταμείου τούς περνά ο builder την επόμενη φορά που θα ανοίξει.'],
						['y', 'Μοίρασε τους συνδέσμους προσωπικού', 'Στείλε το <b>Πρότυπο εκκίνησης</b> (καρτέλα Πρόσθετα) με τους συνδέσμους και τους κωδικούς QR για κουζίνα, μπαρ, σέρβις και ταμείο. Κάθε συσκευή μπορεί να εγκαταστήσει τη σελίδα ως εφαρμογή και να ενεργοποιήσει ειδοποιήσεις push.']
					],
					notes: [
						'Κάθε πιάτο πρέπει να έχει κουζίνα ή μπαρ, αλλιώς οι παραγγελίες δεν πάνε σωστά.',
						'Χάθηκε συσκευή ή έφυγε υπάλληλος: διάγραψε τον σύνδεσμο προσωπικού στον builder. Όλες οι συσκευές με αυτόν κλειδώνονται αμέσως και δεν παίρνουν πια ειδοποιήσεις push.'
					]
				},
				{
					id: 'cancel', title: 'Ακύρωση',
					lead: 'Ο πελάτης μπορεί να ακυρώσει οποιαδήποτε στιγμή για το τέλος της τρέχουσας χρονιάς, απλώς με email. Όσα έχουν ήδη πληρωθεί δεν επιστρέφονται. Τη συνδρομή την τερματίζεις εσύ στο Stripe, στο τέλος της περιόδου.',
					decision: [
						['ok', 'Επίλεξε στο Stripe', 'Στο τέλος της περιόδου', 'Σωστό. Το μενού μένει online έως το τέλος της πληρωμένης χρονιάς· μετά η συνδρομή λήγει και δεν χρεώνεται τίποτα άλλο.'],
						['bad', 'Μην επιλέξεις', 'Αμέσως', 'Το μενού βγαίνει αμέσως offline, παρότι ο πελάτης έχει πληρώσει τη χρονιά.']
					],
					steps: [
						'Επιβεβαίωσε στον πελάτη: <i>«Λάβαμε την ακύρωσή σας, το μενού σας μένει online έως τις [ημερομηνία].»</i> Η ημερομηνία φαίνεται στο Stripe στη συνδρομή ως «Current period».',
						'Άνοιξε το <b>dashboard.stripe.com</b>. Πάνω πρέπει να είναι ενεργό το <b>Live mode</b>, όχι «Test mode».',
						'<b>Customers</b> → αναζήτησε τον πελάτη με το email του.',
						'Στο <b>Subscriptions</b>, δίπλα στη συνδρομή πάτησε <b>⋯</b> → <b>Cancel subscription</b>.',
						'Επίλεξε <b>At end of current period</b> και επιβεβαίωσε με <b>Cancel subscription</b>.',
						'Έλεγχος: στη συνδρομή γράφει τώρα «Cancels [ημερομηνία]». Τέλος.'
					],
					timeline: [
						['Σήμερα', 'y', 'Η ακύρωση καταχωρήθηκε', 'Στον builder και στο SmartPilot™ δεν αλλάζει ακόμη τίποτα.'],
						['Έως το τέλος της περιόδου', 'a', 'Όλα συνεχίζουν', 'Μενού, πρόσθετα και QR λειτουργούν όπως πριν. Δεν έρχεται πια υπενθύμιση ανανέωσης.'],
						['Στο τέλος της περιόδου', 'a', 'Η συνδρομή λήγει', 'Το Stripe αναφέρει τη λήξη, το μενού βγαίνει αυτόματα offline, το WeeklyReport σταματά.']
					],
					notes: ['Επιστροφή σε μεμονωμένη περίπτωση παρ’ όλα αυτά: Stripe → <b>Payments</b> → η πληρωμή → <b>Refund</b>.']
				},
				{
					id: 'delete', title: 'Πλήρης διαγραφή πελάτη',
					lead: 'Η «Διαγραφή πελάτη» στον builder αφαιρεί μόνο το μενού. Αν ο πελάτης είχε ποτέ συνδρομή ή ServiceHub, η βάση δεδομένων το μπλοκάρει μέχρι να φύγουν οι εξαρτώμενες εγγραφές.',
					decision: [
						['neutral', 'Πελάτης χωρίς συνδρομή', 'Ένα κλικ', '<b>Διαγραφή πελάτη</b> στον builder → επιβεβαίωση. Τέλος.'],
						['ok', 'Πελάτης με συνδρομή ή ServiceHub', 'Τρία βήματα', 'Πρώτα τερματισμός στο Stripe, μετά καθάρισμα στο Supabase, μετά διαγραφή στον builder.']
					],
					steps: [
						'Τρέχει ακόμη η συνδρομή; Ακύρωσέ την πρώτα στο Stripe (δες <a href="#cancel">Ακύρωση</a>). Η διαγραφή στο Supabase <b>δεν</b> τερματίζει συνδρομή Stripe· ο πελάτης θα συνέχιζε να πληρώνει.',
						'Άνοιξε <b>Supabase → SQL Editor</b>, επικόλλησε το παρακάτω μπλοκ, αντικατάστησε παντού το <b>SLUG</b> με το slug του πελάτη, <b>Run</b>.',
						'Επίλεξε τον πελάτη στον builder → <b>Διαγραφή πελάτη</b> → επιβεβαίωση. Τώρα πετυχαίνει· ο σύνδεσμος SmartPilot™, οι συσκευές push και οι κωδικοί ταμείου φεύγουν αυτόματα μαζί.'
					],
					code: DELETE_SQL,
					notes: ['Ποτέ για το El Greco: είναι ο πελάτης επίδειξης του site (live demo, πρόσβαση «Website-Demo»).']
				},
				{
					id: 'emails', title: 'Όλα τα αυτόματα μηνύματα',
					lead: 'Τι στέλνεται αυτόματα. Κάθε email φαίνεται μετά και στη <b>Δραστηριότητα</b> του builder. Οι πελάτες παίρνουν τα email στη γλώσσα του site από το οποίο παρήγγειλαν (DE, EN ή IT)· τα μηνύματα προς εσένα είναι πάντα στα γερμανικά. Παρακάτω τα θέματα όπως τα παίρνει ένας πελάτης στα αγγλικά.',
					tables: [
						{
							title: 'Προς τον πελάτη', head: ['Θέμα', 'Πότε'],
							rows: [
								['Your order at Smart Menu Solutions', 'Αμέσως μετά την πληρωμή ετήσιου πακέτου, και στην αναβάθμιση από Smart Discovery'],
								['Welcome to Smart Discovery', 'Αμέσως μετά την αγορά του Smart Discovery'],
								['… guests opened your menu – your Smart Discovery report', 'Ημέρα 6 του Smart Discovery'],
								['Your Smart Discovery trial has ended', 'Ημέρα 7 χωρίς αναβάθμιση'],
								['Your subscription renews on [date]', '30 ημέρες πριν από την αυτόματη ανανέωση'],
								['Your renewal at Smart Menu Solutions', 'Μετά από επιτυχημένη ανανέωση'],
								['Your renewal has failed – action needed', 'Απέτυχε η χρέωση της ανανέωσης'],
								['Your subscription has been deactivated', '7 ημέρες μετά την αποτυχημένη πληρωμή, μενού offline'],
								['Your upgrade to [plan]', 'Μετά από αναβάθμιση πακέτου'],
								['[Add-on] has been added', 'Μετά την προσθήκη πρόσθετου'],
								['Smart WeeklyReport™: [name]', 'Κάθε Δευτέρα πρωί, μόνο με WeeklyReport']
							]
						},
						{
							title: 'Προς εσένα (ενημέρωση)', head: ['Θέμα', 'Σημασία'],
							rows: [
								['Neue Bestellung eingegangen', 'Νέος πελάτης (ετήσιο πακέτο ή Smart Discovery)'],
								['Dateien zur Bestellung eingegangen / erneut hochgeladen', 'Ήρθαν μενού, λογότυπο και φωτογραφίες, μπορείς να ξεκινήσεις'],
								['Neue Speisekarte zur Verlängerung / Verlängerung: keine neue Speisekarte', 'Ο πελάτης ανανέωσε μέσω του συνδέσμου πληρωμής'],
								['Smart-Discovery-Bericht verschickt', 'Ημέρα 6 μιας δοκιμής'],
								['Smart Discovery abgelaufen (kein Upgrade)', 'Τέλος δοκιμής, μενού offline'],
								['Upgrade von Smart Discovery', 'Πελάτης δοκιμής αγόρασε ετήσιο πακέτο: επέκτεινε το μενού στο πλήρες πακέτο'],
								['Automatische Verlängerung erfolgreich', 'Όλα καλά'],
								['Automatische Verlängerung fehlgeschlagen', 'Ο πελάτης πήρε σύνδεσμο πληρωμής, 7 ημέρες περιθώριο'],
								['Abo automatisch deaktiviert', 'Μενού offline, ο πελάτης δεν πλήρωσε'],
								['Verlängerung bestätigt', 'Ο πελάτης πλήρωσε μέσω του συνδέσμου, μενού ξανά online'],
								['Tarif-Upgrade', 'Ο πελάτης αναβάθμισε: επέκτεινε το μενού'],
								['Add-on nachträglich gebucht', 'Ρύθμισε το πρόσθετο'],
								['Tische & Kassennummern eingegangen – [όνομα]', 'Ήρθαν τα στοιχεία ServiceHub του πελάτη'],
								['Neue Kontaktanfrage (DE/EN/IT) – [όνομα]', 'Φόρμα επικοινωνίας του site: απάντησε']
							]
						},
						{
							title: 'Προειδοποιήσεις: πρέπει να κάνεις κάτι', warn: true, head: ['Θέμα', 'Τι κάνεις'],
							rows: [
								['Altes Stripe-Abo nach Verlängerung bitte von Hand beenden', 'Ακύρωσε αμέσως την παλιά συνδρομή στο Stripe'],
								['Add-on bezahlt, DB-Update fehlgeschlagen', 'Ενεργοποίησε το πρόσθετο με το χέρι στον builder'],
								['Upgrade bezahlt, DB-Update fehlgeschlagen', 'Προσάρμοσε το πακέτο στο Supabase σύμφωνα με το Stripe'],
								['Upgrade-Zahlung fehlgeschlagen, Rückbau unvollständig', 'Δες στο Stripe ποιο πακέτο ισχύει και προσάρμοσέ το']
							]
						}
					],
					notes: ['Αν η Δραστηριότητα δείχνει «Kundenbestätigung übersprungen (ungültige E-Mail)», ο πελάτης έδωσε λάθος email. Επικοινώνησε μαζί του τηλεφωνικά ή μέσω WhatsApp.']
				},
				{
					id: 'where', title: 'Πού βλέπω τι;',
					list: [
						'<b>Τα εισερχόμενά σου</b>: όλα τα μηνύματα και οι προειδοποιήσεις προς εσένα.',
						'<b>Δραστηριότητα</b> (builder): τα τελευταία 50 email που στάλθηκαν, με παραλήπτη.',
						'<b>Επισκόπηση → Χρειάζονται ανανέωση</b>: πελάτες με ληγμένη ή απενεργοποιημένη συνδρομή.',
						'<b>Πελάτης → Πρόσθετα</b>: πρόσθετα, κατάσταση Smart Discovery («Ημέρα X από 7»), διακόπτης «Μενού online».',
						'<b>Stripe</b>: πληρωμές, συνδρομές, ακυρώσεις, επιστροφές.',
						'<b>SmartPilot™</b>: ό,τι βλέπει ο πελάτης: πακέτο, αναβάθμιση/ανανέωση, κωδικός QR και στατιστικά.'
					]
				},
				{
					id: 'faq', title: 'Συχνές περιπτώσεις',
					qa: [
						['Ο πελάτης δεν ανέβασε τίποτα.', 'Ο σύνδεσμος ανεβάσματος είναι στην επιβεβαίωση παραγγελίας του. Ή στέλνει το μενού με email.'],
						['Ο πελάτης θέλει μια αλλαγή στο μενού.', 'Στέλνει την αλλαγή, εμείς την κάνουμε στον builder και αποθηκεύουμε. Το μενού ενημερώνεται αμέσως, ο κωδικός QR μένει ίδιος.'],
						['Ο πελάτης λέει ότι το μενού είναι offline.', 'Επίλεξε τον πελάτη. Αν πάνω γράφει «Έληξε» ή «Απενεργοποιημένη»: στείλε τον σύνδεσμο ανανέωσης. Αλλιώς έλεγξε στην καρτέλα Πρόσθετα ότι το «Μενού online» είναι ενεργό.'],
						['Το Smart Discovery δεν ξεκινά.', 'Το «Μενού online» πρέπει να είναι ενεργό. Οι 7 ημέρες ξεκινούν με την επόμενη εκτέλεση νωρίς το πρωί.'],
						['Ο πελάτης θέλει περισσότερα πιάτα ή γλώσσες.', 'Αναβάθμιση μέσω SmartPilot™ (κουμπί «Αναβάθμιση»).'],
						['Διπλή χρέωση;', 'Δες στο Stripe αν ο πελάτης έχει δύο ενεργές συνδρομές. Ακύρωσε αμέσως την παλιά και επέστρεψε τη διπλή πληρωμή.']
					]
				}
			]
		}
	};

	// ---------------------------------------------------------------- render
	const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	const svgLines = (text, x, y) => String(text).split('\n').map((line, i, all) => `<tspan x="${x}" y="${y + (i - (all.length - 1) / 2) * 15}">${esc(line)}</tspan>`).join('');

	function overviewSvg(o) {
		// Top row: the normal year; bottom row: what happens when the renewal fails.
		const box = (x, y, w, label, cls) => `<g class="g-node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="52" rx="10"></rect><text x="${x + w / 2}" y="${y + 30}" text-anchor="middle">${svgLines(label, x + w / 2, y + 30)}</text></g>`;
		const arrow = (d, cls = '') => `<path class="g-arrow ${cls}" d="${d}" marker-end="url(#g-head)"></path>`;
		return `<svg class="guide-overview" viewBox="0 -4 960 266" role="img" aria-label="${esc(o.title)}">
			<defs><marker id="g-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"></path></marker></defs>
			${box(10, 40, 130, o.order, 'who-c')}${arrow('M140,66 L170,66')}
			${box(172, 40, 130, o.setup, 'who-y')}${arrow('M302,66 L332,66')}
			${box(334, 40, 130, o.online, 'who-y')}${arrow('M464,66 L494,66')}
			${box(496, 40, 120, o.year, 'who-a')}${arrow('M616,66 L646,66')}
			${box(648, 40, 140, o.remind, 'who-a')}${arrow('M788,66 L818,66')}
			${box(820, 40, 130, o.renew, 'who-a')}
			${arrow('M885,40 C885,22 560,22 556,36', 'ok')}
			<text class="g-label ok" x="720" y="13" text-anchor="middle">${esc(o.ok)}</text>
			${arrow('M885,92 L885,196', 'bad')}
			${box(820, 198, 130, o.fail, 'who-a bad')}${arrow('M820,224 L790,224', 'bad')}
			${box(640, 198, 148, o.grace, 'who-c')}${arrow('M640,224 L610,224', 'bad')}
			${box(470, 198, 138, o.off, 'who-a bad')}
			${arrow('M539,198 C539,150 420,150 400,94', 'ok')}
			<text class="g-label ok" x="300" y="150" text-anchor="middle">${esc(o.back)}</text>
		</svg>`;
	}

	const whoTag = (t, who) => `<span class="who who-${who}">${esc(t.legend[who])}</span>`;

	function flowHtml(t, flow) {
		return `<ol class="g-flow">${flow.map(([who, title, text]) => `<li class="g-card who-${who}">${whoTag(t, who)}<strong>${esc(title)}</strong><p>${text}</p></li>`).join('')}</ol>`;
	}
	function timelineHtml(t, items) {
		return `<ol class="g-timeline">${items.map(([when, who, title, text]) => `<li class="who-${who}"><span class="g-when">${esc(when)}</span><div>${whoTag(t, who)}<strong>${esc(title)}</strong><p>${text}</p></div></li>`).join('')}</ol>`;
	}
	function sectionHtml(t, s, index) {
		const parts = [`<section class="panel g-section" id="${s.id}"><p class="eyebrow">${index + 1}</p><h2>${esc(s.title)}</h2>`];
		if (s.lead) parts.push(`<p class="g-lead">${s.lead}</p>`);
		if (s.decision) parts.push(`<div class="g-decision">${s.decision.map(([kind, label, badge, text]) => `<div><span class="g-dlabel">${esc(label)}</span><span class="g-badge ${kind}">${esc(badge)}</span><p>${text}</p></div>`).join('')}</div>`);
		if (s.flow) parts.push(flowHtml(t, s.flow));
		if (s.steps) parts.push(`<ol class="g-steps">${s.steps.map((step) => `<li>${step}</li>`).join('')}</ol>`);
		if (s.code) parts.push(`<pre class="g-code"><code>${esc(s.code)}</code></pre>`);
		if (s.timeline) parts.push(timelineHtml(t, s.timeline));
		if (s.tables) s.tables.forEach((table) => parts.push(`<h3 class="g-table-title${table.warn ? ' warn' : ''}">${esc(table.title)}</h3><div class="g-table-wrap"><table class="g-table"><thead><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell, i) => i === 0 ? `<td><b>${esc(cell)}</b></td>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`));
		if (s.list) parts.push(`<ul class="g-list">${s.list.map((item) => `<li>${item}</li>`).join('')}</ul>`);
		if (s.qa) parts.push(`<div class="g-qa">${s.qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</div>`);
		if (s.notes) parts.push(s.notes.map((note) => `<p class="g-note">${note}</p>`).join(''));
		parts.push('</section>');
		return parts.join('');
	}

	function currentLang() {
		let lang = 'de';
		try { lang = localStorage.getItem(LANG_STORAGE_KEY) || 'de'; } catch { /* default */ }
		return LANGS.includes(lang) ? lang : 'de';
	}

	function render(lang) {
		const t = CONTENT[lang] || CONTENT.de;
		document.documentElement.lang = CONTENT[lang] ? lang : 'de';
		document.querySelector('#guideEyebrow').textContent = t.eyebrow;
		document.querySelector('#guideTitle').textContent = t.title;
		document.querySelectorAll('[data-guide-lang]').forEach((button) => button.classList.toggle('active', button.dataset.guideLang === lang));
		document.querySelector('#guideRoot').innerHTML = `
			<p class="g-intro">${esc(t.intro)}</p>
			<div class="g-legend">${['c', 'a', 'y'].map((who) => whoTag(t, who)).join('')}</div>
			<section class="panel g-section"><h2>${esc(t.overview.title)}</h2><div class="g-overview-wrap">${overviewSvg(t.overview)}</div></section>
			<nav class="panel g-toc"><p class="eyebrow">${esc(t.toc)}</p><ol>${t.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ol></nav>
			${t.sections.map((s, i) => sectionHtml(t, s, i)).join('')}`;
		// Nav labels of the shared sidebar come from admin-strings.js.
		const strings = (window.ADMIN_STRINGS || {})[lang] || (window.ADMIN_STRINGS || {}).de || {};
		document.querySelectorAll('[data-i18n]').forEach((el) => { if (strings[el.dataset.i18n]) el.textContent = strings[el.dataset.i18n]; });
	}

	document.querySelectorAll('[data-guide-lang]').forEach((button) => button.addEventListener('click', () => {
		try { localStorage.setItem(LANG_STORAGE_KEY, button.dataset.guideLang); } catch { /* this visit only */ }
		render(button.dataset.guideLang);
	}));
	render(currentLang());
	if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
