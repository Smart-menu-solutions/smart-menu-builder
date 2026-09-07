/* Supabase Auth + MFA. Requires auth-config.js and the Supabase browser client first. */
const supabaseClient = window.supabase.createClient(
	AUTH_CONFIG.supabaseUrl,
	AUTH_CONFIG.supabasePublishableKey
);

async function hasValidSession() {
	const { data } = await supabaseClient.auth.getSession();
	if (!data.session) return false;
	const { data: assurance } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
	return assurance?.currentLevel === 'aal2';
}

async function logout() {
	await supabaseClient.auth.signOut();
	location.replace('login.html');
}

async function requireAuth() {
	if (!(await hasValidSession())) location.replace('login.html');
}

async function redirectIfAuthed() {
	if (await hasValidSession()) location.replace('admin.html');
}

async function attemptLogin(email, password, code) {
	const { error: signInError } = await supabaseClient.auth.signInWithPassword({
		email: email.trim(),
		password
	});
	if (signInError) return { error: 'E-Mail-Adresse oder Passwort ist falsch.' };

	const { data: factors, error: factorError } = await supabaseClient.auth.mfa.listFactors();
	const factor = factors?.totp?.find((item) => item.status === 'verified');
	if (factorError || !factor) {
		await supabaseClient.auth.signOut();
		return { error: 'Für dieses Konto ist noch keine Authenticator-App eingerichtet.' };
	}

	const { data: challenge, error: challengeError } = await supabaseClient.auth.mfa.challenge({ factorId: factor.id });
	if (challengeError) return { error: 'Die Zwei-Faktor-Anmeldung konnte nicht gestartet werden.' };

	const { error: verifyError } = await supabaseClient.auth.mfa.verify({
		factorId: factor.id,
		challengeId: challenge.id,
		code: String(code).replace(/\s/g, '')
	});
	if (verifyError) {
		await supabaseClient.auth.signOut();
		return { error: 'Der Authenticator-Code ist falsch oder abgelaufen.' };
	}
	return { ok: true };
}
