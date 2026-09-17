// Read-only stats lookup for stats.html - same trust model as the existing
// renewal function: a uuid token in the URL is the only credential, no
// login. See subscriptions.stats_token (0009_analytics_reports.sql) for why
// this is a separate token from renewal_token.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;
const REPORT_DAYS = 7;

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

// Sums view_count per label for one metric_type, across all rows in `rows`
// whose day falls within [from, to] (inclusive), returned sorted highest
// first.
function topLabels(rows: { day: string; metric_type: string; label: string; view_count: number }[], metricType: string, from: string, to: string, limit: number) {
	const totals = new Map<string, number>();
	for (const row of rows) {
		if (row.metric_type !== metricType || row.day < from || row.day > to) continue;
		totals.set(row.label, (totals.get(row.label) || 0) + row.view_count);
	}
	return [...totals.entries()]
		.map(([label, count]) => ({ label, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

function sumVisits(rows: { day: string; metric_type: string; view_count: number }[], from: string, to: string) {
	return rows.reduce((sum, row) => row.metric_type === 'visit' && row.day >= from && row.day <= to ? sum + row.view_count : sum, 0);
}

// stats.html has no language switcher - it's always English - so category/
// dish labels (tracked under their source-menu name, e.g. German for most
// customers, to keep counts from fragmenting by language) need translating
// to English here for display. Mirrors menu.js's categoryName()/
// itemTranslation() lookup into menus.translations, minus the browser-only
// static fallback file (menus.translations is the live, DB-backed
// translation source - the fallback file only covers a handful of legacy
// demo clients that predate it). Falls back to the untranslated source
// name if this menu has no English translation for it yet.
type MenuTranslations = { categories?: Record<string, { name?: string }>; items?: Record<string, { name?: string }> } | undefined;
const SUPPORTED_LANGUAGES = ['en', 'de'];
function translateCategoryLabel(translations: MenuTranslations, sourceLabel: string): string {
	return translations?.categories?.[sourceLabel]?.name || sourceLabel;
}
function translateItemLabel(translations: MenuTranslations, sourceLabel: string): string {
	const translated = translations?.items?.[sourceLabel]?.name || sourceLabel;
	// Some menus number their dishes for ordering ("1. Classic Bruschetta")
	// - useful on the printed/live menu, just clutter in a stats summary, so
	// strip a leading "<number>. " before displaying it here.
	return translated.replace(/^\d+\.\s*/, '');
}

const COURSE_ORDER = ['starter', 'main', 'dessert', 'drink'];

// sfm_reco labels are '<course>::<dish name>' (see menu.js). Sums per
// (course, dish) across the range, then keeps only the single most-
// recommended dish for each course - courses with no data are omitted
// entirely rather than shown empty. Every completed quiz always logs
// exactly one starter + one main + one dessert (canRunSmartMatch() only
// ever offers the quiz once all three course pools are non-empty, and
// pickCourse() then always returns something from a non-empty pool) - so
// the total across all 'starter' dishes equals the number of completed
// quizzes this week, which is a far more meaningful "total" for the ring
// than summing the three displayed top-dish counts (those can be smaller
// than the real total once a course has more than one distinct dish
// recommended).
function topRecommendations(rows: { day: string; metric_type: string; label: string; view_count: number }[], from: string, to: string) {
	const totals = new Map<string, Map<string, number>>();
	for (const row of rows) {
		if (row.metric_type !== 'sfm_reco' || row.day < from || row.day > to) continue;
		const separatorIndex = row.label.indexOf('::');
		if (separatorIndex < 0) continue;
		const course = row.label.slice(0, separatorIndex);
		const dish = row.label.slice(separatorIndex + 2);
		if (!totals.has(course)) totals.set(course, new Map());
		const dishTotals = totals.get(course)!;
		dishTotals.set(dish, (dishTotals.get(dish) || 0) + row.view_count);
	}
	const items: { course: string; dish: string; count: number }[] = [];
	for (const course of COURSE_ORDER) {
		const dishTotals = totals.get(course);
		if (!dishTotals || dishTotals.size === 0) continue;
		const [topDish, topCount] = [...dishTotals.entries()].sort((a, b) => b[1] - a[1])[0];
		items.push({ course, dish: topDish, count: topCount });
	}
	const starterTotals = totals.get('starter');
	const totalCompletions = starterTotals ? [...starterTotals.values()].reduce((sum, count) => sum + count, 0) : 0;
	return { items, totalCompletions };
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

	const url = new URL(request.url);
	const token = url.searchParams.get('token') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);
	const requestedLanguage = url.searchParams.get('lang') || '';
	const language = SUPPORTED_LANGUAGES.includes(requestedLanguage) ? requestedLanguage : 'en';

	const { data: subscription, error } = await supabase
		.from('subscriptions')
		.select('id, status, menu_slug, menus(name, analytics_reports_enabled, smart_food_match_enabled, translations)')
		.eq('stats_token', token)
		.maybeSingle();
	if (error || !subscription) return json({ error: 'This link is no longer valid.' }, 404);

	const menu = subscription.menus as { name: string; analytics_reports_enabled: boolean; smart_food_match_enabled: boolean; translations: Record<string, MenuTranslations> | null } | null;
	if (!menu?.analytics_reports_enabled) {
		return json({ addonActive: false });
	}

	const today = new Date();
	const rangeEnd = isoDate(today);
	const rangeStart = isoDate(addDays(today, -(REPORT_DAYS - 1)));
	const previousRangeEnd = isoDate(addDays(today, -REPORT_DAYS));
	const previousRangeStart = isoDate(addDays(today, -(2 * REPORT_DAYS - 1)));

	const { data: rows, error: rowsError } = await supabase
		.from('menu_view_daily')
		.select('day, metric_type, label, view_count')
		.eq('menu_slug', subscription.menu_slug)
		.gte('day', previousRangeStart)
		.lte('day', rangeEnd);
	if (rowsError) return json({ error: 'Could not load stats.' }, 500);

	const allRows = rows ?? [];
	const sfm = topRecommendations(allRows, rangeStart, rangeEnd);
	const translations = menu.translations?.[language];
	return json({
		addonActive: true,
		menuName: menu.name,
		rangeStart,
		rangeEnd,
		totalVisits: sumVisits(allRows, rangeStart, rangeEnd),
		previousWeekVisits: sumVisits(allRows, previousRangeStart, previousRangeEnd),
		topCategories: topLabels(allRows, 'category', rangeStart, rangeEnd, 5)
			.map((item) => ({ ...item, label: translateCategoryLabel(translations, item.label) })),
		topDishes: topLabels(allRows, 'dish', rangeStart, rangeEnd, 5)
			.map((item) => ({ ...item, label: translateItemLabel(translations, item.label) })),
		sfmEnabled: !!menu.smart_food_match_enabled,
		topRecommendations: sfm.items.map((item) => ({ ...item, dish: translateItemLabel(translations, item.dish) })),
		sfmTotalCompletions: sfm.totalCompletions
	});
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
