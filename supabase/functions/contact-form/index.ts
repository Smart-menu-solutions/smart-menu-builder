// Contact form of smartmenusolutions.com (contact.html / de/contact.html).
// The form posts here directly (plain HTML form, no JavaScript needed);
// the message goes to our inbox through Resend - the same sender as every
// other system email - and the visitor is redirected to our own thank-you
// page. Replaces FormSubmit, whose emails never reached the Outlook inbox.
//
// Nothing of the message is stored: notifications_log only records that a
// contact email was sent (used for the simple flood limit below).

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFICATION_EMAIL = Deno.env.get('NOTIFICATION_EMAIL') ?? 'smartmenusolutions@outlook.com';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Smart Menu Builder <onboarding@resend.dev>';
const SITE = 'https://smartmenusolutions.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// More contact emails than this within 10 minutes is a bot, not a customer.
const MAX_PER_10_MIN = 15;

function escapeHtml(value: string) {
	return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] as string));
}

function redirect(path: string) {
	return new Response(null, { status: 303, headers: { Location: `${SITE}/${path}` } });
}

Deno.serve(async (request) => {
	if (request.method !== 'POST') return redirect('contact.html');

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return redirect('contact.html');
	}
	const lang = form.get('lang') === 'de' ? 'de' : 'en';
	const contactPage = lang === 'de' ? 'de/contact.html' : 'contact.html';
	const field = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max);

	// Honeypot: a hidden field real visitors never see. Pretend success so
	// bots get no signal, but send nothing.
	if (field('_honey', 200)) return redirect('thank-you.html');

	const name = field('name', 120);
	const email = field('email', 200);
	const message = field('message', 5000);
	if (!name || !message || !EMAIL_PATTERN.test(email)) return redirect(`${contactPage}?error=1`);

	const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
	const { count } = await supabase.from('notifications_log').select('id', { count: 'exact', head: true }).eq('kind', 'contact_form').gte('created_at', since);
	if ((count ?? 0) >= MAX_PER_10_MIN) return redirect(`${contactPage}?error=1`);

	const subject = lang === 'de' ? `Neue Kontaktanfrage (DE) – ${name}` : `New contact request (EN) – ${name}`;
	const html = `<h2 style="font-family:Arial,sans-serif">${escapeHtml(subject)}</h2>
		<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
			<tr><td style="padding:4px 12px 4px 0;color:#737373">Name</td><td style="padding:4px 0">${escapeHtml(name)}</td></tr>
			<tr><td style="padding:4px 12px 4px 0;color:#737373">E-Mail</td><td style="padding:4px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
			<tr><td style="padding:4px 12px 4px 0;color:#737373;vertical-align:top">Nachricht</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(message)}</td></tr>
		</table>
		<p style="font-family:Arial,sans-serif;font-size:12px;color:#737373">Einfach auf diese E-Mail antworten – die Antwort geht direkt an ${escapeHtml(email)}.</p>`;

	let providerMessageId: string | null = null;
	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFICATION_EMAIL], reply_to: email, subject, html })
		});
		const data = await response.json().catch(() => ({}));
		if (response.ok) providerMessageId = data.id ?? null;
		else console.error('Resend API error', response.status, data);
	} catch (error) {
		console.error('Resend request failed', error);
	}
	await supabase.from('notifications_log').insert({ subscription_id: null, kind: 'contact_form', sent_to: NOTIFICATION_EMAIL, provider_message_id: providerMessageId });

	// Only claim success if Resend actually accepted the email.
	return providerMessageId ? redirect('thank-you.html') : redirect(`${contactPage}?error=1`);
});
