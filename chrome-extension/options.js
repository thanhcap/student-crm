// Options page: persists the capture token + endpoint into chrome.storage.local.
// Nothing here talks to the network — the content script does the posting.

const endpointEl = document.getElementById('endpoint');
const tokenEl = document.getElementById('token');
const statusEl = document.getElementById('status');

chrome.storage.local.get(['crm_token', 'crm_endpoint']).then(({ crm_token, crm_endpoint }) => {
  if (crm_endpoint) endpointEl.value = crm_endpoint;
  if (crm_token) tokenEl.value = crm_token;
});

function show(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? '#059669' : '#dc2626';
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
}

document.getElementById('save').addEventListener('click', async () => {
  const endpoint = endpointEl.value.trim();
  const token = tokenEl.value.trim();
  if (!endpoint || !token) { show('Both fields are required.', false); return; }
  // Refuse a plaintext endpoint — the token would travel in the clear.
  if (!/^https:\/\//i.test(endpoint)) { show('Endpoint must start with https://', false); return; }
  await chrome.storage.local.set({ crm_endpoint: endpoint, crm_token: token });
  show('Saved.');
});
