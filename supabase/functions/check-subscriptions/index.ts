import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SITE_ORIGIN = 'https://smartmenusolutions.com';
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[character] as string));
}

// Customer-facing HTML signature (not used on the internal owner-notification
// bullet-list emails). Mirrors scratch/email-signature.html exactly, image
// URLs point at the live site so they render in any mail client.
const EMAIL_SIGNATURE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;margin-top:18px;">
<tr>
<td style="padding:0 18px 0 0;vertical-align:middle;"><img src="https://smartmenusolutions.com/assets/images/logo-signature.png" width="64" height="64" alt="Smart Menu Solutions" style="display:block;border:0;width:64px;height:64px;"></td>
<td style="padding:0 18px 0 0;vertical-align:middle;border-right:1px solid #E7E5E1;width:1px;"></td>
<td style="padding:0 0 0 18px;vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding:0;font-size:15px;font-weight:bold;color:#262421;line-height:1.4;">George Tsiafitsas</td></tr>
<tr><td style="padding:0 0 10px 0;font-size:13px;color:#737373;line-height:1.4;">CEO&nbsp;&middot;&nbsp;<span style="color:#F66A09;font-weight:bold;">Smart</span><span style="color:#262421;font-weight:bold;">&nbsp;Menu Solutions</span></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="mailto:smartmenusolutions@outlook.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-email.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions@outlook.com</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://smartmenusolutions.com" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-website.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">smartmenusolutions.com</span></a></td></tr>
<tr><td style="padding:9px 0 3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://instagram.com/smartmenusolutions/" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-instagram.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:3px 0;font-size:12.5px;color:#737373;line-height:1;"><a href="https://www.tiktok.com/@smartmenusolutions" style="text-decoration:none;color:#737373;"><img src="https://smartmenusolutions.com/assets/images/signature/icon-tiktok.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;width:16px;height:16px;margin-right:7px;"><span style="vertical-align:middle;">@smartmenusolutions</span></a></td></tr>
<tr><td style="padding:9px 0 0 23px;font-size:12.5px;color:#737373;line-height:1;">Greece</td></tr>
</table>
</td>
</tr>
</table>`;

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

async function sendNotification(subscriptionId: string | null, subject: string, lines: Record<string, string>) {
	const html = `<h2>${escapeHtml(subject)}</h2><ul>${
		Object.entries(lines).map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? '-'))}</li>`).join('')
	}</ul>`;
	await sendEmail(NOTIFICATION_EMAIL, subscriptionId, subject, subject, html);
}

// Sent to the customer once the 7-day grace period has run out and the menu
// has just been taken offline.
async function sendDeactivatedEmail(subscriptionId: string, to: string, contactName: string, renewalToken: string) {
	if (!EMAIL_PATTERN.test(to)) {
		console.error('Skipping deactivation customer email: no valid email on file', subscriptionId);
		return;
	}
	const subject = 'Ihr Abo wurde deaktiviert';
	const renewalUrl = `${SITE_ORIGIN}/renewal.html?token=${renewalToken}`;
	const html = `
		<p>Hallo ${escapeHtml(contactName || '')},</p>
		<p>da die Zahlung für Ihre Verlängerung ausblieb, wurde Ihr Abo nun deaktiviert und Ihr Menü ist über den QR-Code nicht mehr erreichbar.</p>
		<p>Sie können Ihr Abo jederzeit über folgenden Link reaktivieren:</p>
		<p><a href="${renewalUrl}">Abo reaktivieren</a></p>
		<p>Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:smartmenusolutions@outlook.com">smartmenusolutions@outlook.com</a>.</p>
		<p>Mit freundlichen Grüßen</p>
		${EMAIL_SIGNATURE}
	`;
	await sendEmail(to, subscriptionId, 'Kundenmail: Abo deaktiviert', subject, html);
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
		.select('id, plan, renewal_token, menu_slug, customers(contact_name, email)')
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

		// Grace period is over — take the menu offline until the customer renews.
		await supabase.from('menus').update({ is_published: false }).eq('slug', subscription.menu_slug);

		await Promise.all([
			sendNotification(subscription.id, 'Abo automatisch deaktiviert', {
				'Subscription-ID': subscription.id,
				Plan: subscription.plan,
				'Renewal-Link': `${SITE_ORIGIN}/renewal.html?token=${subscription.renewal_token}`
			}),
			sendDeactivatedEmail(subscription.id, subscription.customers?.email ?? '', subscription.customers?.contact_name ?? '', subscription.renewal_token)
		]);
	}

	return new Response(JSON.stringify({ checked: true, deactivated: (toDeactivate ?? []).length }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
});
