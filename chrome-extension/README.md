# Relationship CRM Capture — Chrome extension

Adds a **+ Add to CRM** button to LinkedIn profile pages. One click reads the
visible name / headline / company off the page and posts it to your own CRM,
creating a real relationship row.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `chrome-extension/` folder.
3. Click the extension's **Details → Extension options**.
4. Paste the **endpoint** and **capture token** from the CRM
   (Settings → Capture), then Save.
5. Visit any `https://www.linkedin.com/in/…` profile. The button appears in the
   bottom-right corner.

## How auth works

The extension holds an opaque capture token, not a login session. The endpoint
looks that token up server-side and derives the owning user from it — the
request body never names a user, so a token can only ever write into its own
owner's CRM. Regenerating the token in Settings deletes the old one immediately.

The token is stored in `chrome.storage.local` (this browser only) and is sent
over HTTPS to your endpoint and nowhere else. There is no analytics, no
background script, and no permission to read any site other than LinkedIn
profiles.

## Notes

- Capturing the same profile URL twice returns the existing relationship rather
  than creating a duplicate.
- LinkedIn changes its DOM regularly. If the name or company stops being picked
  up, the selectors to update live in `extractProfileData()` in
  `content-script.js`.
- `icons/` is intentionally absent — Chrome falls back to a default icon, which
  is fine for an unpacked developer install. Add PNGs and an `"icons"` key to
  `manifest.json` before publishing to the Web Store.
