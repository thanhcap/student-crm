// KEEP BEHAVIORALLY IDENTICAL to the copy in src/app/page.js (see CHANGELOG_FABLE).
// v4 adds the graph walker (nodes = sequence_steps rows, edges = sequence_edges rows).

// ===== legacy linear helpers (still used for per-step condition skips + A/B) =====
export function stepConditionMet(step: any, enrollment: any, sends: any[]): boolean {
  const cond = step.condition || 'always';
  if (cond === 'always') return true;
  const prior = sends.filter((s) => s.enrollment_id === enrollment.id);
  const replied = prior.some((s) => s.replied_at);
  const opened = prior.some((s) => s.opened_at);
  if (cond === 'if_no_reply') return !replied;
  if (cond === 'if_no_open') return !opened;
  if (cond === 'if_opened') return opened && !replied;
  return true;
}
export function resolveDueStep(enrollment: any, steps: any[], sends: any[]) {
  let idx = enrollment.current_step;
  while (idx < steps.length) {
    if (stepConditionMet(steps[idx], enrollment, sends)) return { step: steps[idx], index: idx };
    idx++;
  }
  return null;
}
export function pickSubjectVariant(step: any, enrollment: any) {
  if (step.subject_b && String(step.subject_b).trim()) {
    return enrollment.id % 2 === 0 ? { subject: step.subject, variant: 'A' } : { subject: step.subject_b, variant: 'B' };
  }
  return { subject: step.subject, variant: null };
}
export function computeNextSendAt(step: any, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + (parseInt(step.wait_days, 10) || 0));
  return d.toISOString().split('T')[0];
}
export function addDaysStr(days: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + (parseInt(String(days), 10) || 0));
  return d.toISOString().split('T')[0];
}

// ===== v4 graph walker =====
export function waitDaysOf(node: any): number {
  const cfg = node?.config || {};
  if (cfg.unit === 'hours') return 0; // next_send_at is a DATE — hours resolve same-day
  const d = parseInt(cfg.days, 10);
  if (!isNaN(d)) return Math.max(0, d);
  return Math.max(0, parseInt(node?.wait_days, 10) || 0);
}
// Delay applied when an enrollment ARRIVES at a node. Wait nodes use their config;
// action nodes keep honoring the legacy wait_days column (backfilled linear chains).
export function arrivalDelayDays(node: any): number {
  return (node?.node_type === 'wait') ? waitDaysOf(node) : Math.max(0, parseInt(node?.wait_days, 10) || 0);
}
export function defaultEdgeFrom(edges: any[], fromId: any) {
  return edges.find((e) => e.from_step_id === fromId && (e.branch || 'default') === 'default')
    || edges.find((e) => e.from_step_id === fromId) || null;
}
// A sequence that predates the canvas (no edges rows) is an implicit straight chain.
export function syntheticChainEdges(nodes: any[]) {
  const chain = nodes.filter((n) => (n.node_type || 'email') !== 'trigger').sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
  const trig = nodes.find((n) => (n.node_type || 'email') === 'trigger');
  const out: any[] = [];
  let prev: any = trig || null;
  for (const n of chain) {
    if (prev) out.push({ id: `syn-${prev.id}-${n.id}`, from_step_id: prev.id, to_step_id: n.id, branch: 'default' });
    prev = n;
  }
  return out;
}
// Condition NODE evaluation (yes/no branch). Unknown data degrades to the "no" branch.
export function evalConditionNode(condType: string, enrollment: any, sends: any[]): boolean {
  const prior = (sends || []).filter((s) => s.enrollment_id === enrollment.id);
  const replied = prior.some((s) => s.replied_at);
  const opened = prior.some((s) => s.opened_at);
  if (condType === 'if_replied') return replied;
  if (condType === 'if_no_reply') return !replied;
  if (condType === 'if_opened') return opened;
  if (condType === 'if_no_open') return !opened;
  return false;
}
// THE shared graph walker. From the enrollment's current node, resolve what to do now.
// Entry wait nodes count as elapsed (whoever pointed the enrollment at a wait already
// applied its delay to next_send_at). Legacy per-step conditions keep skip behavior.
export function resolveNextNode(enrollment: any, nodes: any[], edges: any[], sends: any[]): any {
  const byId: Record<string, any> = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  let node = enrollment.current_node_id != null ? byId[enrollment.current_node_id] : null;
  if (!node) { // legacy enrollment — map current_step onto the ordered non-trigger chain
    const chain = nodes.filter((n) => (n.node_type || 'email') !== 'trigger').sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
    node = chain[enrollment.current_step] || null;
  }
  let entry = true;
  const visited = new Set();
  while (node) {
    if (visited.has(node.id)) return { action: 'complete', reason: 'cycle' };
    visited.add(node.id);
    const t = node.node_type || 'email';
    if (t === 'trigger') { node = byId[defaultEdgeFrom(edges, node.id)?.to_step_id]; entry = false; continue; }
    if (t === 'wait') {
      if (entry) { node = byId[defaultEdgeFrom(edges, node.id)?.to_step_id]; entry = false; continue; }
      return { action: 'wait', node, waitDays: waitDaysOf(node) };
    }
    if (t === 'condition') {
      const yes = evalConditionNode((node.config && node.config.type) || 'if_no_reply', enrollment, sends);
      const e = edges.find((x) => x.from_step_id === node.id && x.branch === (yes ? 'yes' : 'no'));
      if (!e) return { action: 'complete', reason: 'no_branch' };
      node = byId[e.to_step_id]; entry = false; continue;
    }
    if (t === 'goal') return { action: 'goal', node };
    // action node — legacy per-step condition column still skips (backfilled chains)
    if ((node.condition || 'always') !== 'always' && !stepConditionMet(node, enrollment, sends)) {
      node = byId[defaultEdgeFrom(edges, node.id)?.to_step_id]; entry = false; continue;
    }
    return { action: t === 'email' ? 'email' : 'task', node };
  }
  return { action: 'complete', reason: 'end' };
}
// After executing `node`, where does the enrollment go next?
export function advanceAfterNode(node: any, nodes: any[], edges: any[]): any {
  const byId: Record<string, any> = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const next = byId[defaultEdgeFrom(edges, node.id)?.to_step_id];
  if (!next) return { done: true };
  return { done: false, nodeId: next.id, waitDays: arrivalDelayDays(next) };
}
