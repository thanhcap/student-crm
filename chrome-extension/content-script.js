// Injects a "+ Add to CRM" button on LinkedIn profile pages.
//
// LinkedIn is a single-page app: navigating from one profile to another does
// not re-run a content script, so the button is created once and a URL watcher
// resets its label when the profile underneath changes.

function extractProfileData() {
  const name = document.querySelector('h1')?.innerText?.trim() || '';
  const title = document.querySelector('.text-body-medium')?.innerText?.trim() || '';
  // The first /company/ link on a profile is the current employer.
  const companyEl = [...document.querySelectorAll('a[href*="/company/"]')][0];
  const company = companyEl?.innerText?.trim().split('\n')[0] || '';
  return { name, title, company, linkedin_url: window.location.href.split('?')[0] };
}

const IDLE_LABEL = '+ Add to CRM';

const btn = document.createElement('button');
btn.textContent = IDLE_LABEL;
btn.style.cssText =
  'position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 16px;background:#111827;' +
  'color:white;border:none;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;' +
  'box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:system-ui,-apple-system,sans-serif;';
document.body.appendChild(btn);

function flash(text, revertAfter = 2500) {
  btn.textContent = text;
  btn.disabled = false;
  setTimeout(() => { btn.textContent = IDLE_LABEL; }, revertAfter);
}

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Adding…';

  const data = extractProfileData();
  if (!data.name) { flash('Could not read this profile'); return; }

  const { crm_token, crm_endpoint } = await chrome.storage.local.get(['crm_token', 'crm_endpoint']);
  if (!crm_token || !crm_endpoint) { flash('Open extension Options first', 4000); return; }

  try {
    const res = await fetch(crm_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${crm_token}` },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.duplicate) flash('Already in your CRM');
    else if (res.ok) flash('Added ✓');
    else if (res.status === 401) flash('Invalid token — check Options', 4000);
    else flash(body.error ? `Failed: ${body.error}` : 'Failed', 4000);
  } catch {
    flash('Network error');
  }
});

// Reset the label when LinkedIn swaps profiles under us without a page load.
let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    btn.textContent = IDLE_LABEL;
    btn.disabled = false;
  }
}, 1000);
