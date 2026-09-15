// Smart Food Match quiz UI copy - a standalone string catalog, separate
// from translation-fallbacks.js (which only covers per-dish name/
// description translations for specific seeded clients). There is no
// generic UI-chrome translation mechanism in this codebase today (see
// menu.js's buildContactLinks(), whose "Call"/"WhatsApp"/"Directions"
// labels are hardcoded English) - this file is the first one, scoped to
// just this feature's static text.
//
// German is the fully-authored launch language. The other four language
// codes (matching admin.js's LANGUAGE_CATALOG: en/el/it/es) are stubbed
// with the same key shape but not yet translated - menu.js falls back to
// German for any language missing here, it never throws.
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
	// TODO: translate - falls back to German (menu.js never throws on a
	// missing language here, same convention as fallbackTranslation()).
	en: null,
	el: null,
	it: null,
	es: null
};
