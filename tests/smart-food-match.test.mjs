import { test } from 'vitest';
import assert from 'node:assert/strict';

// Stub browser globals before importing menu.js (it no-ops without them).
globalThis.window = { MENU_TRANSLATION_FALLBACKS: undefined };
globalThis.document = undefined;

const menu = await import('../data/assets/js/menu.js');
const { courseTypeOf, buildCourseCatalog, canRunSmartMatch, pickCourse, matchSmartFoodMenu } = menu;

function dish(name, overrides = {}) {
	return { name, description: '', price: '0.00', appetiteSize: '', style: '', isFavorite: false, ...overrides };
}

function fullyTaggedClient() {
	return {
		slug: 'test-client',
		categories: [
			{ name: 'Antipasti', courseType: 'starter', items: [dish('Bruschetta', { style: 'fresh', appetiteSize: 'small' }), dish('Carpaccio', { style: 'hearty', appetiteSize: 'medium' })] },
			{ name: 'Piatti Principali', courseType: 'main', items: [dish('Bistecca', { style: 'hearty', appetiteSize: 'large' }), dish('Insalata', { style: 'fresh', appetiteSize: 'medium', isFavorite: true })] },
			{ name: 'Dolci', courseType: 'dessert', items: [dish('Tiramisu', { style: 'special', appetiteSize: 'medium' })] },
			{ name: 'Bevande', courseType: 'drink', items: [dish('Cola')] }
		]
	};
}

test('courseTypeOf returns "other" for legacy categories with no courseType set', () => {
	assert.equal(courseTypeOf({ name: 'Old Section' }), 'other');
	assert.equal(courseTypeOf({ name: 'Old Section', courseType: '' }), 'other');
});

test('buildCourseCatalog buckets items by category courseType and ignores drink/other', () => {
	const pools = buildCourseCatalog(fullyTaggedClient());
	assert.equal(pools.starter.length, 2);
	assert.equal(pools.main.length, 2);
	assert.equal(pools.dessert.length, 1);
	assert.ok(!('drink' in pools));
});

test('canRunSmartMatch is true only when all three courses have candidates', () => {
	assert.equal(canRunSmartMatch(fullyTaggedClient()), true);
	const missingDessert = fullyTaggedClient();
	missingDessert.categories = missingDessert.categories.filter((category) => category.courseType !== 'dessert');
	assert.equal(canRunSmartMatch(missingDessert), false);
});

test('pickCourse falls back to the full pool when nothing matches style/size/favorite', () => {
	const pool = [dish('A', { style: 'fresh' }), dish('B', { style: 'hearty' })];
	const pick = pickCourse(pool, { style: 'special' }, () => 0);
	assert.equal(pick.name, 'A');
});

test('pickCourse with favoritesOnly filters to favorites when at least one exists', () => {
	const pool = [dish('A'), dish('B', { isFavorite: true })];
	const pick = pickCourse(pool, { favoritesOnly: true }, () => 0);
	assert.equal(pick.name, 'B');
});

test('pickCourse with favoritesOnly falls back to the full pool when no favorites exist', () => {
	const pool = [dish('A'), dish('B')];
	const pick = pickCourse(pool, { favoritesOnly: true }, () => 0);
	assert.equal(pick.name, 'A');
});

test('pickCourse prefers appetiteSize among style-filtered results, falling back on no match', () => {
	const pool = [dish('Small hearty', { style: 'hearty', appetiteSize: 'small' }), dish('Large hearty', { style: 'hearty', appetiteSize: 'large' }), dish('Fresh', { style: 'fresh' })];
	const pick = pickCourse(pool, { style: 'hearty', appetiteSize: 'large' }, () => 0);
	assert.equal(pick.name, 'Large hearty');
	const noSizeMatch = pickCourse(pool, { style: 'hearty', appetiteSize: 'very-large' }, () => 0);
	assert.equal(noSizeMatch.name, 'Small hearty');
});

test('pickCourse rng is deterministic at the edges (0 -> first, 0.999 -> last)', () => {
	const pool = [dish('First'), dish('Middle'), dish('Last')];
	assert.equal(pickCourse(pool, {}, () => 0).name, 'First');
	assert.equal(pickCourse(pool, {}, () => 0.999).name, 'Last');
});

test('pickCourse returns null for an empty pool', () => {
	assert.equal(pickCourse([], { style: 'fresh' }, () => 0), null);
});

test('matchSmartFoodMenu returns exactly one starter/main/dessert for a fully-tagged client', () => {
	const result = matchSmartFoodMenu(fullyTaggedClient(), { appetiteSize: 'medium', style: 'fresh' }, () => 0);
	assert.ok(result.starter && result.main && result.dessert);
	assert.deepEqual(result.skipped, []);
});

test('matchSmartFoodMenu marks a course as skipped (not thrown) when its pool is empty', () => {
	const client = fullyTaggedClient();
	client.categories = client.categories.filter((category) => category.courseType !== 'dessert');
	const result = matchSmartFoodMenu(client, { appetiteSize: 'medium', style: 'fresh' }, () => 0);
	assert.equal(result.dessert, null);
	assert.deepEqual(result.skipped, ['dessert']);
	assert.ok(result.starter && result.main);
});
