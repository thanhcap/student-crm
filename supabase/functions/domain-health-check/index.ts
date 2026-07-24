// B7 — domain health monitor. Uses Deno's built-in DNS resolver; no external API.
// Auth: the caller's JWT identifies the user (the body is NOT trusted for user_id).
import { createClient } from 'npm:@supabase/supabase-js@2';

async function checkTXT(name: string, mustInclude: string): Promise<string> {
  try {
    const records = await Deno.resolveDns(name, 'TXT');
    const flat = records.map((r: string[]) => r.join('')).join(' ');
    return flat.includes(mustInclude) ? 'pass' : 'missing';
  } catch {
    return 'missing';
  }
}

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth = req.headers.get('Authorization') || '';
  const { data: userData, error: uerr } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (uerr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { domain?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return json({ error: 'invalid_domain' }, 400);

  const [spf, dkim, dmarc] = await Promise.all([
    checkTXT(domain, 'v=spf1'),
    checkTXT(`google._domainkey.${domain}`, 'v=DKIM1'),
    checkTXT(`_dmarc.${domain}`, 'v=DMARC1'),
  ]);

  await admin.from('domain_health_checks').insert({
    user_id: userId, domain, spf_status: spf, dkim_status: dkim, dmarc_status: dmarc,
  });
  return json({ domain, spf, dkim, dmarc });
});
