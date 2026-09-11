import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smart-menu-solutions.github.io/smart-menu-solutions';
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;

	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFICATION_EMAIL], subject, html })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}

	const { error: logError } = await supabase.from('notifications_log').insert({
		subscription_id: subscriptionId,
		kind: subject,
		sent_to: NOTIFICATION_EMAIL,
		provider_message_id: providerMessageId
	});
	if (logError) console.error('Failed to write notifications_log', logError);
}

// Daily job (triggered by Supabase Cron): the 7-day grace period after
// expiry is enforced here — invoice.payment_failed (in stripe-webhook)
// already moved these subscriptions to status "expired" with a
// grace_until date, so this only has to find the ones whose grace period
// has run out and flip them to "deactivated".
Deno.serve(async (_request) => {
	const today = new Date().toISOString().slice(0, 10);

	const { data: toDeactivate, error } = await supabase
		.from('subscriptions')
		.select('id, plan, renewal_token')
		.eq('status', 'expired')
		.lt('grace_until', today);

	if (error) {
		console.error('Failed to query expired subscriptions', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}

	for (const subscription of toDeactivate ?? []) {
		await supabase.from('subscriptions').update({
			status: 'deactivated',
			updated_at: new Date().toISOString()
		}).eq('id', subscription.id);

		await sendNotification(subscription.id, 'Abo automatisch deaktiviert', {
			'Subscription-ID': subscription.id,
			Plan: subscription.plan,
			'Renewal-Link': `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}`
		});
	}

	return new Response(JSON.stringify({ checked: true, deactivated: (toDeactivate ?? []).length }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
});
