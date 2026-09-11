// Vitest setup: stub fetch so menu.js's auto-load never hits the network,
// and make sure the translation catalog is attached to window.
vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));

await import('../data/assets/js/translation-fallbacks.js');

if (!window.MENU_TRANSLATION_FALLBACKS) {
	throw new Error('MENU_TRANSLATION_FALLBACKS was not attached to window');
}
