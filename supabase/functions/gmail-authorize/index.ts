// gmail-authorize v4 — builds the Google OAuth consent URL server-side (no
// client env needed) and redirects the browser there. Scopes: gmail.send (the
// runner sends), gmail.readonly (gmail-sync polls replies), userinfo.email
// (gmail-oauth stores the account address — v3 omitted readonly; the old
// client-side URL omitted userinfo.email, which is why email_address was NULL).
// Public endpoint, same trust model as the gmail-oauth callback.
// Usage: GET /functions/v1/gmail-authorize?user_id=<auth.users.id>
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id') || url.searchParams.get('state');
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return new Response('missing or invalid user_id', { status: 400 });
  }
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  if (!clientId) return new Response('GOOGLE_CLIENT_ID not configured', { status: 500 });

  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth`;
  const scope = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: userId,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});
