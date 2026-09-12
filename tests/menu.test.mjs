import { test } from 'vitest';
import assert from 'node:assert/strict';

// Stub browser globals before importing menu.js (it no-ops without them).
const windowStub = { MENU_TRANSLATION_FALLBACKS: undefined };
globalThis.window = windowStub;
globalThis.document = undefined;

await import('../data/assets/js/translation-fallbacks.js');
assert.ok(windowStub.MENU_TRANSLATION_FALLBACKS, 'fallback catalog should attach to window');
assert.ok(windowStub.MENU_TRANSLATION_FALLBACKS['restaurant-zum-dorfkrug'].en, 'en catalog should exist');

const menu = await import('../data/assets/js/menu.js');

const dorfkrug = { slug: 'restaurant-zum-dorfkrug', name: 'Zum Dorfkrug' };
const schnitzel = { name: 'Wiener Schnitzel' };
const starters = { name: 'Vorspeisen' };
const { fallbackTranslation, categoryName, itemTranslation, escapeHtml } = menu;

test('requestedLanguage defaults to en when no lang param', () => {
	assert.equal(fallbackTranslation(dorfkrug, 'en', 'item', 'Wiener Schnitzel')?.name, 'Wiener Schnitzel');
});

test('each language path resolves via fallback catalog', () => {
	for (const lang of ['en', 'el', 'it', 'es']) {
		const t = fallbackTranslation(dorfkrug, lang, 'item', 'Wiener Schnitzel');
		assert.ok(t && t.name, `item translation missing for ${lang}`);
		const cat = fallbackTranslation(dorfkrug, lang, 'category', 'Vorspeisen');
		assert.ok(cat, `category translation missing for ${lang}`);
	}
});

test('unknown language returns null (no hardcoded cross-client chain)', () => {
	assert.equal(fallbackTranslation(dorfkrug, 'xx', 'item', 'Wiener Schnitzel'), null);
});

test('missing catalog for client returns null', () => {
	assert.equal(fallbackTranslation({ slug: 'nope' }, 'en', 'item', 'X'), null);
});

test('categoryName prefers client translations over fallback', () => {
	const client = { slug: 'restaurant-zum-dorfkrug', translations: { en: { categories: { 'Vorspeisen': { name: 'Custom Starters' } } } } };
	assert.equal(categoryName(client, starters), 'Custom Starters');
});

test('itemTranslation falls back to empty object', () => {
	assert.deepEqual(itemTranslation(dorfkrug, { name: 'Nonexistent' }), {});
});

test('escapeHtml escapes all dangerous characters', () => {
	assert.equal(escapeHtml('<script>&"\'</script>'), '&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;');
	assert.equal(escapeHtml(null), '');
});
