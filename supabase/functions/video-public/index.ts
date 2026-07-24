// video-public — A-1's public viewer backend.
//
// The `media` bucket is private and its RLS policy only lets a user read
// objects under their own uid prefix. A shared video link is watched by
// someone who has no session at all, so the signing has to happen server-side
// with the service role, gated on the unguessable shared_token.
//
// Two rules this enforces that a client-side implementation could not:
//   1. storage_path is never returned to the caller — only a signed URL that
//      expires in an hour.
//   2. The token is the ONLY thing that grants access; there is no way to ask
//      for a different video by id.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return json({ error: 'missing_token' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: msg } = await admin.from('video_messages').select('*')
    .eq('shared_token', token).maybeSingle();
  if (!msg) return json({ error: 'not_found' }, 404);

  const { data: signed, error: signErr } = await admin.storage.from('media')
    .createSignedUrl(msg.storage_path, 3600);
  if (signErr || !signed?.signedUrl) return json({ error: 'unavailable' }, 500);

  // Best-effort view counter — a failure here must not block playback.
  await admin.from('video_messages')
    .update({ view_count: (msg.view_count || 0) + 1 }).eq('id', msg.id);

  // Deliberately narrow payload: no storage_path, no user_id, no client_id.
  return json({
    url: signed.signedUrl,
    duration_seconds: msg.duration_seconds,
    created_at: msg.created_at,
    view_count: (msg.view_count || 0) + 1,
  });
});
