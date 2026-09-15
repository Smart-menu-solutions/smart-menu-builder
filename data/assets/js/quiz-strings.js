// Smart Food Match quiz UI copy - a standalone string catalog, separate
// from translation-fallbacks.js (which only covers per-dish name/
// description translations for specific seeded clients). There is no
// generic UI-chrome translation mechanism in this codebase today (see
// menu.js's buildContactLinks(), whose "Call"/"WhatsApp"/"Directions"
// labels are hardcoded English) - this file is the first one, scoped to
// just this feature's static text.
//
// All five languages (matching admin.js's LANGUAGE_CATALOG: en/de/el/it/es)
// are translated below. menu.js still falls back to German for any language
// code missing from this catalog entirely - it never throws.
window.SMART_FOOD_MATCH_STRINGS = {
	de: {
		openButton: '✨ Empfehlung finden',
		title: '🍽️ Smart Food Match',
		intro: 'Finde deine perfekte Empfehlung in 10 Sekunden.',
		closeLabel: 'Schließen',
		nextLabel: 'Weiter',
		submitLabel: '✨ Meine Empfehlung anzeigen',
		restartLabel: 'Nochmal versuchen',
		q1: {
			text: 'Was möchtest du heute?',
			options: [
				{ value: 'food', label: 'Essen' },
				{ value: 'drink', label: 'Trinken' },
				{ value: 'sweet', label: 'Etwas Süßes' },
				{ value: 'surprise', label: 'Überrasch mich' }
			]
		},
		q2: {
			text: 'Wie groß ist dein Appetit?',
			options: [
				{ value: 'small', label: 'Klein' },
				{ value: 'medium', label: 'Mittel' },
				{ value: 'large', label: 'Groß' },
				{ value: 'very-large', label: 'Sehr groß' }
			]
		},
		q3: {
			text: 'Worauf hast du gerade Lust?',
			options: [
				{ value: 'fresh', label: 'Frisch & leicht' },
				{ value: 'hearty', label: 'Herzhaft & kräftig' },
				{ value: 'special', label: 'Etwas Besonderes' },
				{ value: 'quick', label: 'Schnell & unkompliziert' },
				{ value: 'favorites', label: 'Zeig mir euren Favoriten' }
			]
		},
		resultTitle: 'Deine Empfehlung',
		starterLabel: '🥗 Vorspeise',
		mainLabel: '🍖 Hauptgericht',
		dessertLabel: '🍰 Dessert',
		whyLabel: '💡 Warum diese Empfehlung?',
		// {appetite} and {style} are filled in from the Q2/Q3 answer labels.
		whyTemplate: 'Passend zu deinem Appetit ({appetite}) und deiner Lust auf {style} haben wir dir diese Kombination aus unserer Speisekarte zusammengestellt.',
		whyFavoritesTemplate: 'Du wolltest unsere Favoriten sehen - hier ist unsere Empfehlung dafür.',
		skippedMessage: 'Für diesen Gang haben wir aktuell noch keinen passenden Vorschlag.'
	},
	en: {
		openButton: '✨ Find my recommendation',
		title: '🍽️ Smart Food Match',
		intro: 'Find your perfect recommendation in 10 seconds.',
		closeLabel: 'Close',
		nextLabel: 'Next',
		submitLabel: '✨ Show my recommendation',
		restartLabel: 'Try again',
		q1: {
			text: 'What would you like today?',
			options: [
				{ value: 'food', label: 'Food' },
				{ value: 'drink', label: 'Drink' },
				{ value: 'sweet', label: 'Something sweet' },
				{ value: 'surprise', label: 'Surprise me' }
			]
		},
		q2: {
			text: 'How big is your appetite?',
			options: [
				{ value: 'small', label: 'Small' },
				{ value: 'medium', label: 'Medium' },
				{ value: 'large', label: 'Large' },
				{ value: 'very-large', label: 'Very large' }
			]
		},
		q3: {
			text: 'What are you in the mood for?',
			options: [
				{ value: 'fresh', label: 'Fresh & light' },
				{ value: 'hearty', label: 'Hearty & rich' },
				{ value: 'special', label: 'Something special' },
				{ value: 'quick', label: 'Quick & simple' },
				{ value: 'favorites', label: 'Show me your favorites' }
			]
		},
		resultTitle: 'Your recommendation',
		starterLabel: '🥗 Starter',
		mainLabel: '🍖 Main course',
		dessertLabel: '🍰 Dessert',
		whyLabel: '💡 Why this recommendation?',
		whyTemplate: 'Based on your appetite ({appetite}) and your craving for {style}, we put together this combination from our menu.',
		whyFavoritesTemplate: 'You wanted to see our favorites - here\'s our recommendation for that.',
		skippedMessage: 'We don\'t have a matching suggestion for this course yet.'
	},
	el: {
		openButton: '✨ Βρες την πρότασή σου',
		title: '🍽️ Smart Food Match',
		intro: 'Βρες την τέλεια πρότασή σου σε 10 δευτερόλεπτα.',
		closeLabel: 'Κλείσιμο',
		nextLabel: 'Επόμενο',
		submitLabel: '✨ Δείξε μου την πρότασή μου',
		restartLabel: 'Δοκίμασε ξανά',
		q1: {
			text: 'Τι θα ήθελες σήμερα;',
			options: [
				{ value: 'food', label: 'Φαγητό' },
				{ value: 'drink', label: 'Ποτό' },
				{ value: 'sweet', label: 'Κάτι γλυκό' },
				{ value: 'surprise', label: 'Έκπληξέ με' }
			]
		},
		q2: {
			text: 'Πόση όρεξη έχεις;',
			options: [
				{ value: 'small', label: 'Μικρή' },
				{ value: 'medium', label: 'Μέτρια' },
				{ value: 'large', label: 'Μεγάλη' },
				{ value: 'very-large', label: 'Πολύ μεγάλη' }
			]
		},
		q3: {
			text: 'Τι σου κάνει κέφι αυτή τη στιγμή;',
			options: [
				{ value: 'fresh', label: 'Φρέσκο & ελαφρύ' },
				{ value: 'hearty', label: 'Πλούσιο & δυνατό' },
				{ value: 'special', label: 'Κάτι ιδιαίτερο' },
				{ value: 'quick', label: 'Γρήγορο & απλό' },
				{ value: 'favorites', label: 'Δείξε μου τα αγαπημένα σας' }
			]
		},
		resultTitle: 'Η πρότασή σου',
		starterLabel: '🥗 Ορεκτικό',
		mainLabel: '🍖 Κυρίως πιάτο',
		dessertLabel: '🍰 Επιδόρπιο',
		whyLabel: '💡 Γιατί αυτή η πρόταση;',
		whyTemplate: 'Με βάση την όρεξή σου ({appetite}) και την επιθυμία σου για {style}, φτιάξαμε αυτόν τον συνδυασμό από το μενού μας.',
		whyFavoritesTemplate: 'Ήθελες να δεις τα αγαπημένα μας - ορίστε η πρότασή μας για αυτό.',
		skippedMessage: 'Για αυτό το πιάτο δεν έχουμε ακόμα κατάλληλη πρόταση.'
	},
	it: {
		openButton: '✨ Trova il mio consiglio',
		title: '🍽️ Smart Food Match',
		intro: 'Trova il tuo consiglio perfetto in 10 secondi.',
		closeLabel: 'Chiudi',
		nextLabel: 'Avanti',
		submitLabel: '✨ Mostra il mio consiglio',
		restartLabel: 'Riprova',
		q1: {
			text: 'Cosa desideri oggi?',
			options: [
				{ value: 'food', label: 'Da mangiare' },
				{ value: 'drink', label: 'Da bere' },
				{ value: 'sweet', label: 'Qualcosa di dolce' },
				{ value: 'surprise', label: 'Sorprendimi' }
			]
		},
		q2: {
			text: 'Quanto appetito hai?',
			options: [
				{ value: 'small', label: 'Poco' },
				{ value: 'medium', label: 'Medio' },
				{ value: 'large', label: 'Molto' },
				{ value: 'very-large', label: 'Moltissimo' }
			]
		},
		q3: {
			text: 'Cosa ti va in questo momento?',
			options: [
				{ value: 'fresh', label: 'Fresco & leggero' },
				{ value: 'hearty', label: 'Saporito & sostanzioso' },
				{ value: 'special', label: 'Qualcosa di speciale' },
				{ value: 'quick', label: 'Veloce & semplice' },
				{ value: 'favorites', label: 'Mostrami i vostri preferiti' }
			]
		},
		resultTitle: 'Il tuo consiglio',
		starterLabel: '🥗 Antipasto',
		mainLabel: '🍖 Piatto principale',
		dessertLabel: '🍰 Dolce',
		whyLabel: '💡 Perché questo consiglio?',
		whyTemplate: 'In base al tuo appetito ({appetite}) e alla tua voglia di {style}, abbiamo preparato questa combinazione dal nostro menu.',
		whyFavoritesTemplate: 'Volevi vedere i nostri preferiti - ecco il nostro consiglio.',
		skippedMessage: 'Per questa portata non abbiamo ancora un suggerimento adatto.'
	},
	es: {
		openButton: '✨ Encontrar mi recomendación',
		title: '🍽️ Smart Food Match',
		intro: 'Encuentra tu recomendación perfecta en 10 segundos.',
		closeLabel: 'Cerrar',
		nextLabel: 'Siguiente',
		submitLabel: '✨ Mostrar mi recomendación',
		restartLabel: 'Intentar de nuevo',
		q1: {
			text: '¿Qué te apetece hoy?',
			options: [
				{ value: 'food', label: 'Comer' },
				{ value: 'drink', label: 'Beber' },
				{ value: 'sweet', label: 'Algo dulce' },
				{ value: 'surprise', label: 'Sorpréndeme' }
			]
		},
		q2: {
			text: '¿Cuánto apetito tienes?',
			options: [
				{ value: 'small', label: 'Poco' },
				{ value: 'medium', label: 'Medio' },
				{ value: 'large', label: 'Mucho' },
				{ value: 'very-large', label: 'Muchísimo' }
			]
		},
		q3: {
			text: '¿Qué se te antoja ahora mismo?',
			options: [
				{ value: 'fresh', label: 'Fresco & ligero' },
				{ value: 'hearty', label: 'Contundente & sabroso' },
				{ value: 'special', label: 'Algo especial' },
				{ value: 'quick', label: 'Rápido & sencillo' },
				{ value: 'favorites', label: 'Muéstrame vuestros favoritos' }
			]
		},
		resultTitle: 'Tu recomendación',
		starterLabel: '🥗 Entrante',
		mainLabel: '🍖 Plato principal',
		dessertLabel: '🍰 Postre',
		whyLabel: '💡 ¿Por qué esta recomendación?',
		whyTemplate: 'Según tu apetito ({appetite}) y tus ganas de algo {style}, hemos preparado esta combinación de nuestra carta.',
		whyFavoritesTemplate: 'Querías ver nuestros favoritos - aquí tienes nuestra recomendación.',
		skippedMessage: 'Para este plato todavía no tenemos una sugerencia adecuada.'
	}
};
