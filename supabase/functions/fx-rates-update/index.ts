// F31 — daily FX refresh. open.er-api.com free endpoint, no key required.
// Stores rate_to_usd so a non-USD deal converts with: value * fx_rate_to_usd.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) return new Response(JSON.stringify({ error: 'fx_fetch_failed', status: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  const rates = data?.rates || {};
  const rows = Object.entries(rates)
    .filter(([, rate]) => typeof rate === 'number' && (rate as number) > 0)
    .map(([currency, rate]) => ({ currency, rate_to_usd: 1 / (rate as number), updated_at: new Date().toISOString() }));
  if (!rows.length) return new Response(JSON.stringify({ error: 'no_rates' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  const { error } = await admin.from('fx_rates').upsert(rows, { onConflict: 'currency' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { 'Content-Type': 'application/json' } });
});
