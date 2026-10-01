/* Clickjacking guard for the owner and staff pages (admin, login, setup,
   leads, kitchen/waiter/bar/cashier). GitHub Pages can't send
   X-Frame-Options or a frame-ancestors CSP header, so a page that finds itself
   inside someone else's frame hides itself and tries to break out. Loaded
   synchronously in <head>, before anything is shown. Not used on menu.html,
   which may be embedded. */
if (window.top !== window.self) {
	document.documentElement.style.display = 'none';
	try { window.top.location = window.self.location.href; } catch { /* blocked - the page just stays hidden */ }
}
