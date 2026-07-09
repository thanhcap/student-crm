# Fable Changelog — Email Automation v2

Branch: `fable/email-automation-v2`

## Part 1 — Workspace invite duplicate key fix
- `handleInviteMember` now inserts `user_id: null` for pending invites (was inserting the inviter's id, colliding with `UNIQUE(workspace_id, user_id)`).
- Invited email is lowercased; a pre-insert check shows a toast if an invite for that email is already pending.
- **Manual test:** invite the same email twice → second attempt shows "An invite for this email is already pending." toast, no DB error. Verify the row in `workspace_members` has `user_id = null`.

## Part 2 — Dark mode inputs + autofill
- Every `<input>`, `<textarea>`, `<select>` now carries `dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:border-gray-700` (systematic pattern pass).
- Browser autofill override in `globals.css`: dark inset box-shadow + light `-webkit-text-fill-color` under `.dark`.
- Restored the theme bootstrap lost in the branch switch: `layout.js` no longer hardcodes the `dark` class or the void background; a `beforeInteractive` script applies the saved theme pre-paint (no FOUC).
- **Manual test:** toggle dark mode, open Add Relationship — type in one field, autofill another; all text is light on dark backgrounds, no white flash.
