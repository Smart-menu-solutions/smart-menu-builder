// Weekly job (triggered by Supabase Cron, see
// 0010_schedule_weekly_report.sql - Monday 03:15 UTC, 15 min after
// check-subscriptions' daily 03:00 run): emails every customer with the
// Analytics Report add-on active a summary of the just-completed week, with
// a link to the full stats.html dashboard. Also prunes menu_view_daily rows
// older than 35 days, folding retention cleanup into the existing weekly
// cadence instead of adding a second cron job.

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smartmenusolutions.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETENTION_DAYS = 35;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

async function sendEmail(recipient: string, subscriptionId: string | null, kind: string, subject: string, html: string) {
	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [recipient], subject, html })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}

	const { error: logError } = await supabase.from('notifications_log').insert({
		subscription_id: subscriptionId,
		kind,
		sent_to: recipient,
		provider_message_id: providerMessageId
	});
	if (logError) console.error('Failed to write notifications_log', logError);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

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

function trendLine(current: number, previous: number): string {
	if (previous === 0) return current > 0 ? 'Neu diese Woche' : '';
	const change = Math.round(((current - previous) / previous) * 100);
	if (change > 0) return `▲ ${change}% mehr als letzte Woche`;
	if (change < 0) return `▼ ${Math.abs(change)}% weniger als letzte Woche`;
	return 'Gleich wie letzte Woche';
}

function reportHtml(menuName: string, rangeStart: string, rangeEnd: string, totalVisits: number, previousWeekVisits: number, topCategories: { label: string; count: number }[], topDishes: { label: string; count: number }[], statsUrl: string): string {
	const trend = trendLine(totalVisits, previousWeekVisits);
	const listItems = (items: { label: string; count: number }[]) => items.length
		? items.map((item) => `<li>${escapeHtml(item.label)} - ${item.count}×</li>`).join('')
		: '<li>Noch keine Aufrufe diese Woche.</li>';
	return `
		<p>Hallo,</p>
		<p>hier ist der Wochenbericht für <strong>${escapeHtml(menuName)}</strong> (${rangeStart} bis ${rangeEnd}):</p>
		<p style="font-size:20px"><strong>${totalVisits}</strong> Besuche${trend ? ` <span style="color:#666">(${escapeHtml(trend)})</span>` : ''}</p>
		<p><strong>Meistgesehene Kategorien</strong></p>
		<ul>${listItems(topCategories)}</ul>
		<p><strong>Meistgesehene Gerichte</strong></p>
		<ul>${listItems(topDishes)}</ul>
		<p><a href="${statsUrl}">Vollständige Statistik ansehen</a></p>
		<p>Smart Menu Solutions</p>
	`;
}

Deno.serve(async (_request) => {
	const today = new Date();
	const rangeEnd = isoDate(addDays(today, -1));
	const rangeStart = isoDate(addDays(today, -7));
	const previousRangeEnd = isoDate(addDays(today, -8));
	const previousRangeStart = isoDate(addDays(today, -14));

	const { data: subscriptions, error } = await supabase
		.from('subscriptions')
		.select('id, menu_slug, stats_token, customers(contact_name, email), menus!inner(name, analytics_reports_enabled)')
		.eq('status', 'active')
		.eq('menus.analytics_reports_enabled', true);

	if (error) {
		console.error('Failed to query analytics-report subscribers', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}

	let sent = 0;
	for (const subscription of subscriptions ?? []) {
		const customer = subscription.customers as { contact_name: string; email: string } | null;
		const menu = subscription.menus as { name: string } | null;
		if (!customer?.email || !EMAIL_PATTERN.test(customer.email) || !menu) continue;

		const { data: rows } = await supabase
			.from('menu_view_daily')
			.select('day, metric_type, label, view_count')
			.eq('menu_slug', subscription.menu_slug)
			.gte('day', previousRangeStart)
			.lte('day', rangeEnd);
		const allRows = rows ?? [];

		const totalVisits = sumVisits(allRows, rangeStart, rangeEnd);
		const previousWeekVisits = sumVisits(allRows, previousRangeStart, previousRangeEnd);
		const topCategories = topLabels(allRows, 'category', rangeStart, rangeEnd, 3);
		const topDishes = topLabels(allRows, 'dish', rangeStart, rangeEnd, 3);
		const statsUrl = `${SITE_ORIGIN}/stats.html?token=${subscription.stats_token}`;

		await sendEmail(
			customer.email,
			subscription.id,
			'Wochenbericht: Analytics',
			`Wochenbericht: ${menu.name}`,
			reportHtml(menu.name, rangeStart, rangeEnd, totalVisits, previousWeekVisits, topCategories, topDishes, statsUrl)
		);
		sent += 1;
	}

	const cutoff = isoDate(addDays(today, -RETENTION_DAYS));
	const { error: pruneError } = await supabase.from('menu_view_daily').delete().lt('day', cutoff);
	if (pruneError) console.error('Failed to prune old menu_view_daily rows', pruneError);

	return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
