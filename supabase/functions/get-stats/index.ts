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

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
	if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

	const url = new URL(request.url);
	const token = url.searchParams.get('token') || '';
	if (!TOKEN_PATTERN.test(token)) return json({ error: 'Invalid or missing link.' }, 400);

	const { data: subscription, error } = await supabase
		.from('subscriptions')
		.select('id, status, menu_slug, menus(name, analytics_reports_enabled)')
		.eq('stats_token', token)
		.maybeSingle();
	if (error || !subscription) return json({ error: 'This link is no longer valid.' }, 404);

	const menu = subscription.menus as { name: string; analytics_reports_enabled: boolean } | null;
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
	return json({
		addonActive: true,
		menuName: menu.name,
		rangeStart,
		rangeEnd,
		totalVisits: sumVisits(allRows, rangeStart, rangeEnd),
		previousWeekVisits: sumVisits(allRows, previousRangeStart, previousRangeEnd),
		topCategories: topLabels(allRows, 'category', rangeStart, rangeEnd, 5),
		topDishes: topLabels(allRows, 'dish', rangeStart, rangeEnd, 5)
	});
});

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}
