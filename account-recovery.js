import { authOrigin, publicKey } from './account-config.js';

// Credentials stay in memory only. Remove URL credentials before any requests.
const fragment = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
let token = fragment.get('access_token') || '';
const kind = fragment.get('type');
const linkError = fragment.has('error') || query.has('error') || fragment.has('error_code') || query.has('error_code');
history.replaceState(null, '', location.pathname);
fragment.delete('access_token'); fragment.delete('refresh_token');
const status = document.getElementById('status');
const error = document.getElementById('error');
const form = document.getElementById('reset-form');
let busy = false;
let valid = false;

async function authRequest(method, body) {
  const response = await fetch(`${authOrigin}/auth/v1/user`, {
    method, headers: { apikey: publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'expired' : 'request');
  return response.json();
}

async function initialize() {
  if (linkError || !token || (form && kind !== 'recovery')) {
    token = '';
    status.textContent = form ? 'This recovery link is missing, expired or already used. Request a new link from the app.' : 'No valid confirmation session was provided. Follow the latest confirmation email or contact support.';
    return;
  }
  try {
    const user = await authRequest('GET');
    if (!user.id) throw new Error('expired');
    if (!form) {
      status.textContent = user.new_email ? 'This account still has a pending email change. Complete the remaining confirmation instructions.' : 'Your account link was verified. You can return to Digital Tasbeeh.';
      token = ''; return;
    }
    valid = true;
    status.textContent = 'Link verified. Choose your new password below.';
    form.hidden = false;
    for (const element of form.querySelectorAll('input,button')) element.disabled = false;
  } catch {
    token = '';
    status.textContent = 'The link could not be verified. Check your connection and request a fresh link from the app if needed.';
  }
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !valid || !token) return;
  error.textContent = '';
  const password = document.getElementById('password');
  const confirm = document.getElementById('confirm-password');
  if (password.value.length < 8) { error.textContent = 'Use at least 8 characters.'; return; }
  if (password.value !== confirm.value) { error.textContent = 'The passwords do not match.'; return; }
  busy = true;
  const save = document.getElementById('save');
  save.disabled = true; save.textContent = 'Saving…';
  try {
    await authRequest('PUT', { password: password.value });
    token = ''; valid = false;
    password.value = ''; confirm.value = ''; form.hidden = true;
    status.textContent = 'Password changed. Return to Digital Tasbeeh and sign in with your registered email and new password. Your account and progress are kept.';
    document.getElementById('help').hidden = true;
  } catch (err) {
    if (err.message === 'expired') {
      token = ''; valid = false; form.hidden = true;
      error.textContent = 'Your recovery session has expired. Request a new link from the app.';
    } else {
      error.textContent = 'Could not save the password. Check your connection, try a stronger, different password, or request a fresh link.';
    }
  } finally { busy = false; save.disabled = false; save.textContent = 'Save new password'; }
});
window.addEventListener('pagehide', () => { token = ''; valid = false; if (form) form.hidden = true; });
window.addEventListener('pageshow', event => { if(event.persisted) status.textContent = 'For security, reopen your recovery email or request a fresh link from the app.'; });
initialize();
