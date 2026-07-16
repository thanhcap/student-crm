// AI helper — one function, many modes (V3 Cluster A).
// Modes: summary (default) · follow_up_suggestion · meeting_brief ·
//        draft_sequence · icebreakers · compare · classify_reply · nl_search
// Secret required: ANTHROPIC_API_KEY. Every mode degrades to a clean 400 the
// client treats as "AI unavailable" — no crashes without the key.
Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Supabase Edge Function secrets.' }, 400);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'bad request body' }, 400); }
  const { clientName, activities = [], tasks = [], deals = [], notes, mode, query, goal, replyText, compareWith, contact } = payload || {};

  const relCtx = (name: string, acts: any[], tks: any[], dls: any[], nts?: string) => [
    `Relationship: ${name}`,
    nts ? `Notes: ${String(nts).slice(0, 800)}` : '',
    `Recent activities (newest first): ${acts.slice(0, 15).map((a: any) => `[${a.activity_date}] ${a.activity_type}: ${String(a.description || '').slice(0, 160)}`).join(' | ') || 'none'}`,
    `Open tasks: ${tks.filter((t: any) => t.status === 'pending').slice(0, 8).map((t: any) => `${t.title} (due ${t.due_date})`).join(' | ') || 'none'}`,
    `Deals: ${dls.slice(0, 8).map((d: any) => `${d.title} — ${d.stage}, value ${d.value}`).join(' | ') || 'none'}`,
  ].filter(Boolean).join('\n');

  let prompt = '';
  let maxTokens = 300;

  if (mode === 'nl_search') {
    // Translate natural language into a structured filter the client applies.
    maxTokens = 250;
    prompt = `Translate this CRM search request into a JSON filter object. Respond with ONLY the JSON, no prose.
Schema (all fields optional):
{"entity":"clients"|"deals","days_silent_gte":number,"days_silent_lte":number,"priority":"High"|"Medium"|"Low","status":string,"stage":string,"value_gte":number,"value_lte":number,"closing_within_days":number,"network_role":string,"has_open_deal":boolean,"source":string,"text":string}
Client statuses: New, Contacted, Engaged, Active, Inactive. Deal stages: Prospect, Proposal, Negotiation, Contract Sent, Won, Lost.
Request: "${String(query || '').slice(0, 300)}"`;
  } else if (mode === 'meeting_brief') {
    maxTokens = 500;
    prompt = `Write a 5-bullet pre-meeting brief for a meeting with this person. Bullets: (1) relationship history in one line, (2) the last 3 interactions, (3) open deals/asks, (4) anything from notes to remember, (5) ONE suggested talking point. Plain hyphen bullets, no headers, no preamble.\n\n${relCtx(clientName, activities, tasks, deals, notes)}`;
  } else if (mode === 'draft_sequence') {
    maxTokens = 1200;
    prompt = `Draft an email outreach sequence for this goal: "${String(goal || '').slice(0, 200)}".
Respond with ONLY JSON, no prose: {"name":string,"steps":[{"subject":string,"body":string,"wait_days":number}]}
Rules: 3-5 steps. First step wait_days 0. Later steps 3-7 day gaps. Bodies under 120 words, personal tone, use merge tags {{first_name}} and {{company}} where natural, no spam phrases, each follow-up references the previous email briefly. Sign as {{sender_name}}.`;
  } else if (mode === 'icebreakers') {
    maxTokens = 400;
    prompt = `Write exactly 3 short icebreaker openers (1-2 sentences each) for a first cold email to ${clientName}${contact?.title ? `, ${contact.title}` : ''}${contact?.company ? ` at ${contact.company}` : ''}. Reference their role/company naturally, zero flattery clichés, no "I hope this finds you well". Format: numbered list 1-3, nothing else.`;
  } else if (mode === 'compare') {
    maxTokens = 500;
    prompt = `Compare these two CRM relationships side by side in under 120 words: engagement level, deal value, momentum. End with one sentence: which ONE to prioritize this week and why.\n\n=== A ===\n${relCtx(clientName, activities, tasks, deals, notes)}\n\n=== B ===\n${relCtx(compareWith?.name || 'B', compareWith?.activities || [], compareWith?.tasks || [], compareWith?.deals || [], compareWith?.notes)}`;
  } else if (mode === 'classify_reply') {
    maxTokens = 20;
    prompt = `Classify this email reply into exactly one label: interested | not_interested | out_of_office | referred_someone | other. Respond with ONLY the label.\n\nReply:\n${String(replyText || '').slice(0, 1200)}`;
  } else if (mode === 'follow_up_suggestion') {
    prompt = `Based on this CRM data, suggest ONE concrete next follow-up action (a single sentence, imperative, max 25 words, no preamble):\n\n${relCtx(clientName, activities, tasks, deals, notes)}`;
  } else {
    prompt = `Summarize this CRM relationship in 3-5 short sentences for a busy account manager: current status, momentum, risks, and the obvious next step. No headers, no bullets, no preamble.\n\n${relCtx(clientName, activities, tasks, deals, notes)}`;
  }

  if (!prompt) return json({ error: 'unsupported mode' }, 400);
  if (mode !== 'nl_search' && mode !== 'draft_sequence' && mode !== 'icebreakers' && mode !== 'classify_reply' && !clientName) {
    return json({ error: 'clientName required' }, 400);
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: out?.error?.message || `Anthropic API error ${r.status}` }, 400);
  const summary = (out?.content || []).map((c: any) => c.text || '').join('').trim();
  if (!summary) return json({ error: 'empty completion' }, 400);
  return json({ summary });
});
