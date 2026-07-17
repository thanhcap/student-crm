'use client';
// ============================================================================
// DEEP UPDATE v1 — FEATURE 1: THE NETWORK GRAPH
// A full-screen, interactive, force-directed map of the user's entire network.
// Nodes = relationships. Edges = referrals + manual connections + shared
// company + shared school. Hand-rolled physics (no d3), SVG rendering with
// zoom/pan/drag/pin, persisted positions (graph_positions), community
// detection, an insights panel, connection drawing, and PNG/CSV export.
// ============================================================================
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!k) continue;
    (out[k] = out[k] || []).push(item);
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function relTime(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Visual language
// ---------------------------------------------------------------------------
const PRIORITY_COLORS = { High: '#EF4444', Medium: '#F59E0B', Low: '#9CA3AF' };
const ROLE_COLORS = {
  mentor: '#8B5CF6', mentee: '#06B6D4', peer: '#3B82F6',
  recruiter: '#10B981', alumni: '#F59E0B', professor: '#F43F5E',
};
const STATUS_COLORS = {
  New: '#60A5FA', Contacted: '#818CF8', Engaged: '#34D399',
  'Meeting Booked': '#FBBF24', Customer: '#10B981', Inactive: '#9CA3AF',
};
const CLUSTER_PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6',
  '#EC4899', '#84CC16', '#F97316', '#14B8A6', '#A855F7', '#64748B',
];
const FALLBACK_NODE = '#6B7280';

// Edge visual language: referral thick violet; manual solid by type;
// company/school weak + dashed.
const EDGE_STYLES = {
  referred:   { stroke: '#8B5CF6', width: 2.5, dash: null,   label: 'Referral' },
  knows:      { stroke: '#3B82F6', width: 1.8, dash: null,   label: 'Knows' },
  works_with: { stroke: '#10B981', width: 1.8, dash: null,   label: 'Works with' },
  mentors:    { stroke: '#F59E0B', width: 1.8, dash: null,   label: 'Mentors' },
  introduced: { stroke: '#EC4899', width: 1.8, dash: null,   label: 'Introduced' },
  studied_with: { stroke: '#06B6D4', width: 1.8, dash: null, label: 'Studied with' },
  company:    { stroke: '#9CA3AF', width: 1,   dash: '4 4',  label: 'Same company' },
  school:     { stroke: '#60A5FA', width: 1,   dash: '4 4',  label: 'Same school' },
};
const MANUAL_TYPES = ['knows', 'works_with', 'mentors', 'introduced', 'studied_with'];
const MAX_RENDERED_NODES = 500;
const CURVES_OFF_ABOVE = 200;

// ---------------------------------------------------------------------------
// 1.2 — Data model & edge derivation
// ---------------------------------------------------------------------------
export function buildGraphData(clients, manualConnections, opts = {}) {
  const nodes = clients.map(c => ({
    id: c.id,
    name: c.name,
    company: c.company_name,
    school: c.school,
    role: c.network_role,
    priority: c.relationship, // High/Medium/Low — the Priority field
    status: c.status,
    emoji: c.avatar_emoji,
    referredBy: c.referred_by_client_id,
    createdAt: c.created_at,
    // physics state (mutated by the simulation)
    x: 0, y: 0, vx: 0, vy: 0,
    pinned: false,
  }));

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const edges = [];
  const seen = new Set();
  const addEdge = (a, b, type, weight, connId = null) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}-${type}` : `${b}-${a}-${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (nodeById.has(a) && nodeById.has(b)) edges.push({ source: a, target: b, type, weight, connId });
  };

  // 1. Referral edges (clients.referred_by_client_id)
  if (opts.showReferrals !== false) {
    for (const c of clients) if (c.referred_by_client_id) addEdge(c.referred_by_client_id, c.id, 'referred', 3);
  }
  // 2. Manual connections (relationship_connections)
  if (opts.showManual !== false) {
    for (const mc of manualConnections) {
      const type = EDGE_STYLES[mc.relationship_type] ? mc.relationship_type : 'knows';
      addEdge(mc.from_client_id, mc.to_client_id, type, mc.strength ?? 1, mc.id);
    }
  }
  // 3. Shared-company edges (weak, dashed) — skip singletons & huge noisy groups
  if (opts.showCompany) {
    const byCompany = groupBy(clients.filter(c => c.company_name), c => c.company_name.trim().toLowerCase());
    for (const group of Object.values(byCompany)) {
      if (group.length < 2 || group.length > 12) continue;
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          addEdge(group[i].id, group[j].id, 'company', 1);
    }
  }
  // 4. Shared-school edges
  if (opts.showSchool) {
    const bySchool = groupBy(clients.filter(c => c.school), c => c.school.trim().toLowerCase());
    for (const group of Object.values(bySchool)) {
      if (group.length < 2 || group.length > 15) continue;
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          addEdge(group[i].id, group[j].id, 'school', 1);
    }
  }

  // Degree drives node size
  for (const n of nodes) n.degree = 0;
  for (const e of edges) {
    nodeById.get(e.source).degree++;
    nodeById.get(e.target).degree++;
  }

  return { nodes, edges, nodeById };
}

// ---------------------------------------------------------------------------
// 1.7 — Label-propagation community detection
// ---------------------------------------------------------------------------
export function detectClusters(nodes, edges, iterations = 8) {
  const labels = new Map(nodes.map(n => [n.id, n.id])); // everyone starts alone
  const neighbors = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    neighbors.get(e.source)?.push(e.target);
    neighbors.get(e.target)?.push(e.source);
  }
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (const n of shuffle([...nodes])) {
      const nbrs = neighbors.get(n.id) || [];
      if (!nbrs.length) continue;
      const counts = {};
      for (const nb of nbrs) {
        const l = labels.get(nb);
        counts[l] = (counts[l] || 0) + 1;
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      if (String(labels.get(n.id)) !== String(best)) {
        labels.set(n.id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return labels; // Map(nodeId -> communityLabel)
}

// Build cluster metadata: id, member ids, color, "mostly Acme Corp" descriptor
function clusterMeta(nodes, labels) {
  const groups = {};
  for (const n of nodes) {
    const l = String(labels.get(n.id));
    (groups[l] = groups[l] || []).push(n);
  }
  const clusters = Object.entries(groups)
    .map(([label, members]) => ({ label, members }))
    .sort((a, b) => b.members.length - a.members.length);
  return clusters.map((cl, i) => {
    const companies = {};
    const schools = {};
    for (const m of cl.members) {
      if (m.company) companies[m.company] = (companies[m.company] || 0) + 1;
      if (m.school) schools[m.school] = (schools[m.school] || 0) + 1;
    }
    const topCompany = Object.entries(companies).sort((a, b) => b[1] - a[1])[0];
    const topSchool = Object.entries(schools).sort((a, b) => b[1] - a[1])[0];
    let descriptor = '';
    if (topCompany && topCompany[1] >= 2) descriptor = `mostly ${topCompany[0]}`;
    else if (topSchool && topSchool[1] >= 2) descriptor = `mostly ${topSchool[0]}`;
    return {
      label: cl.label,
      ids: cl.members.map(m => m.id),
      size: cl.members.length,
      color: CLUSTER_PALETTE[i % CLUSTER_PALETTE.length],
      descriptor,
    };
  });
}

// ---------------------------------------------------------------------------
// 1.5 — Alternative layouts (position-assignment functions)
// ---------------------------------------------------------------------------
function assignRadialLayout(nodes, width, height) {
  // concentric rings by degree: hubs in the middle, loners on the rim
  const cx = width / 2, cy = height / 2;
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
  const rings = [[], [], [], []];
  for (const n of sorted) {
    if (n.degree >= 6) rings[0].push(n);
    else if (n.degree >= 3) rings[1].push(n);
    else if (n.degree >= 1) rings[2].push(n);
    else rings[3].push(n);
  }
  const radii = [90, 220, 360, 500];
  rings.forEach((ring, ri) => {
    ring.forEach((n, i) => {
      const angle = (i / Math.max(ring.length, 1)) * Math.PI * 2 + ri * 0.35;
      n.x = cx + Math.cos(angle) * radii[ri];
      n.y = cy + Math.sin(angle) * radii[ri];
      n.vx = 0; n.vy = 0;
    });
  });
}

function assignGridLayout(nodes, width, height) {
  const sorted = [...nodes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const cols = Math.ceil(Math.sqrt(sorted.length * (width / Math.max(height, 1))));
  const cellW = 110, cellH = 110;
  const totalW = cols * cellW;
  const rows = Math.ceil(sorted.length / cols);
  const startX = width / 2 - totalW / 2 + cellW / 2;
  const startY = height / 2 - (rows * cellH) / 2 + cellH / 2;
  sorted.forEach((n, i) => {
    n.x = startX + (i % cols) * cellW;
    n.y = startY + Math.floor(i / cols) * cellH;
    n.vx = 0; n.vy = 0;
  });
}

function assignClusterLayout(nodes, edges, width, height) {
  // group by company (fallback: school, then "Other"), one blob per group
  const groups = groupBy(nodes, n => (n.company || n.school || 'Other').trim().toLowerCase());
  const names = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  const cx = width / 2, cy = height / 2;
  const R = Math.min(width, height) * 0.38;
  names.forEach((name, gi) => {
    const g = groups[name];
    const gx = names.length === 1 ? cx : cx + Math.cos((gi / names.length) * Math.PI * 2) * R;
    const gy = names.length === 1 ? cy : cy + Math.sin((gi / names.length) * Math.PI * 2) * R;
    const r = 24 + Math.sqrt(g.length) * 26;
    g.forEach((n, i) => {
      const a = (i / g.length) * Math.PI * 2;
      n.x = gx + Math.cos(a) * (g.length === 1 ? 0 : r);
      n.y = gy + Math.sin(a) * (g.length === 1 ? 0 : r);
      n.vx = 0; n.vy = 0;
    });
  });
}

// ---------------------------------------------------------------------------
// 1.3 — Hand-rolled force simulation (runs on a mutable node array in a ref)
// ---------------------------------------------------------------------------
function useForceSimulation(graphRef, { width, height, runKey, onTick }) {
  const frameRef = useRef(null);

  useEffect(() => {
    const graph = graphRef.current;
    if (!runKey || !graph || !graph.nodes.length || !width || !height) return;
    const { nodes, edges } = graph;
    const CENTER_X = width / 2, CENTER_Y = height / 2;
    const REPULSION = 8000;   // node-node repel strength
    const SPRING = 0.02;      // edge spring pull
    const SPRING_LEN = 120;   // ideal edge length
    const CENTER_PULL = 0.008; // gentle pull toward center
    const DAMPING = 0.85;
    const MAX_VELOCITY = 30;
    let alpha = 1;            // cools over time (simulated annealing)
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // seed positions in a circle if unpositioned
    nodes.forEach((n, i) => {
      if (n.x === 0 && n.y === 0) {
        const angle = (i / nodes.length) * Math.PI * 2;
        n.x = CENTER_X + Math.cos(angle) * 200;
        n.y = CENTER_Y + Math.sin(angle) * 200;
      }
    });

    function tick() {
      alpha *= 0.99;
      // 1. Repulsion between every pair (O(n²) is fine at N<=500)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist2 = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(dist2);
          const force = (REPULSION / dist2) * alpha;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          if (!a.pinned) { a.vx += fx; a.vy += fy; }
          if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
        }
      }
      // 2. Spring attraction along edges
      for (const e of edges) {
        const a = nodeById.get(e.source), b = nodeById.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const displacement = dist - SPRING_LEN;
        const force = displacement * SPRING * (e.weight || 1) * alpha;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }
      // 3. Center gravity + integrate
      for (const n of nodes) {
        if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
        n.vx += (CENTER_X - n.x) * CENTER_PULL * alpha;
        n.vy += (CENTER_Y - n.y) * CENTER_PULL * alpha;
        n.vx *= DAMPING; n.vy *= DAMPING;
        n.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, n.vx));
        n.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, n.vy));
        n.x += n.vx; n.y += n.vy;
      }
      onTick();
      if (alpha > 0.005) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, width, height]);
}

// ---------------------------------------------------------------------------
// 1.8 — Insights (most connected / isolated / bridges / reach)
// ---------------------------------------------------------------------------
function computeInsights(nodes, edges, labels) {
  const byDegree = [...nodes].sort((a, b) => b.degree - a.degree);
  const mostConnected = byDegree.filter(n => n.degree > 0).slice(0, 5);
  const isolated = nodes.filter(n => n.degree === 0);

  // Bridges (approximation): nodes whose neighbors span 2+ communities
  const neighbors = new Map(nodes.map(n => [n.id, new Set()]));
  for (const e of edges) {
    neighbors.get(e.source)?.add(e.target);
    neighbors.get(e.target)?.add(e.source);
  }
  const bridges = nodes.filter(n => {
    const nbrs = [...(neighbors.get(n.id) || [])];
    if (nbrs.length < 2) return false;
    const communities = new Set(nbrs.map(id => String(labels.get(id))));
    return communities.size >= 2;
  }).sort((a, b) => b.degree - a.degree).slice(0, 5);

  // Largest cluster
  const counts = {};
  for (const n of nodes) {
    const l = String(labels.get(n.id));
    counts[l] = (counts[l] || 0) + 1;
  }
  const largestCluster = Math.max(0, ...Object.values(counts));

  // Reach: unique people reachable through referral chains (BFS on referral edges)
  const refNbrs = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    if (e.type !== 'referred') continue;
    refNbrs.get(e.source)?.push(e.target);
    refNbrs.get(e.target)?.push(e.source);
  }
  const visited = new Set();
  let reach = 0;
  for (const n of nodes) {
    if (visited.has(n.id) || !(refNbrs.get(n.id) || []).length) continue;
    const queue = [n.id];
    visited.add(n.id);
    let size = 0;
    while (queue.length) {
      const cur = queue.shift();
      size++;
      for (const nb of refNbrs.get(cur) || []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    reach = Math.max(reach, size);
  }
  return { mostConnected, isolated, bridges, largestCluster, reach };
}

// ---------------------------------------------------------------------------
// Loading / empty states
// ---------------------------------------------------------------------------
function GraphSkeleton() {
  const circles = [
    [30, 40, 22], [55, 25, 14], [70, 55, 18], [42, 68, 12], [60, 78, 10], [20, 65, 12], [80, 30, 10],
  ];
  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden" aria-label="Loading network">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <line x1="30" y1="40" x2="55" y2="25" className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="0.4" />
        <line x1="30" y1="40" x2="70" y2="55" className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="0.4" />
        <line x1="70" y1="55" x2="42" y2="68" className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="0.4" />
        <line x1="42" y1="68" x2="60" y2="78" className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="0.4" />
        <line x1="30" y1="40" x2="20" y2="65" className="stroke-gray-200 dark:stroke-gray-800" strokeWidth="0.4" />
      </svg>
      {circles.map(([x, y, r], i) => (
        <span key={i} className="absolute rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse"
          style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, transform: 'translate(-50%,-50%)', animationDelay: `${i * 0.15}s` }} />
      ))}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] text-gray-400">Laying out your network…</p>
    </div>
  );
}

function GraphEmpty({ onAdd }) {
  return (
    <div className="w-full min-h-[420px] rounded-2xl bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="flex items-center gap-3 mb-4" aria-hidden>
        {['#6366F1', '#10B981', '#F59E0B'].map((c, i) => (
          <span key={i} className="w-8 h-8 rounded-full opacity-60" style={{ background: c }} />
        ))}
      </div>
      <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">Your network map is waiting</h3>
      <p className="text-[13px] text-gray-500 mt-1 max-w-sm">Add relationships and they&apos;ll appear here as a living map — connected by referrals, companies, and schools.</p>
      <button onClick={onAdd} className="mt-5 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Add your first relationship</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function NetworkGraphDeep({ clients, deals, activities, user, showToast, onOpenClient, onAddRelationship }) {
  // ---- remote data --------------------------------------------------------
  const [connections, setConnections] = useState(null); // null = loading
  const [positions, setPositions] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    Promise.all([
      supabase.from('relationship_connections').select('*'),
      supabase.from('graph_positions').select('*'),
    ]).then(([c, p]) => {
      if (!live) return;
      if (c.error || p.error) { setLoadError((c.error || p.error).message); setConnections([]); setPositions([]); return; }
      setConnections(c.data || []);
      setPositions(p.data || []);
    });
    return () => { live = false; };
  }, [user?.id]);

  // ---- controls state ------------------------------------------------------
  const [colorMode, setColorMode] = useState('priority'); // priority | role | status | cluster
  const [edgeToggles, setEdgeToggles] = useState({ referrals: true, manual: true, company: true, school: true });
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [layoutMode, setLayoutMode] = useState('force'); // force | radial | grid | cluster
  const [curvedEdges, setCurvedEdges] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [drawFromId, setDrawFromId] = useState(null); // "draw connection" mode source
  const [pendingConn, setPendingConn] = useState(null); // { fromId, toId } awaiting type pick
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState(null); // Set from insights clicks
  const [legendOpen, setLegendOpen] = useState(true);
  const [interactive, setInteractive] = useState(true);
  const [exporting, setExporting] = useState(false);

  // viewport transform (pan/zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ width: 1200, height: 720 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // simulation plumbing
  const graphRef = useRef({ nodes: [], edges: [], nodeById: new Map() });
  const [, forceTick] = useReducer(x => x + 1, 0);
  const [runKey, setRunKey] = useState(0);
  const posSaveTimer = useRef(null);
  const dirtyPositions = useRef(new Map()); // clientId -> {x, y, pinned}

  // 1.11 — mobile fallback: read-only rendering
  useEffect(() => {
    const check = () => setInteractive(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // measure the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth || 1200, height: el.clientHeight || 720 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [connections === null]);

  // ---- graph construction --------------------------------------------------
  // Cap at the 500 most-connected people (computed on the FULL graph so the
  // notice is honest about what was dropped).
  const { renderClients, capped } = useMemo(() => {
    if (!connections || clients.length <= MAX_RENDERED_NODES) return { renderClients: clients, capped: false };
    const full = buildGraphData(clients, connections, { showCompany: true, showSchool: true });
    const keep = new Set([...full.nodes].sort((a, b) => b.degree - a.degree).slice(0, MAX_RENDERED_NODES).map(n => n.id));
    return { renderClients: clients.filter(c => keep.has(c.id)), capped: true };
  }, [clients, connections]);

  // Rebuild the mutable graph whenever inputs change — preserving physics
  // state (x/y/pinned) for nodes that already existed.
  useEffect(() => {
    if (!connections || !positions) return;
    const prev = graphRef.current.nodeById;
    const built = buildGraphData(renderClients, connections, {
      showReferrals: edgeToggles.referrals,
      showManual: edgeToggles.manual,
      showCompany: edgeToggles.company,
      showSchool: edgeToggles.school,
    });
    const posById = new Map(positions.map(p => [p.client_id, p]));
    for (const n of built.nodes) {
      const old = prev.get(n.id);
      const saved = posById.get(n.id);
      if (old && (old.x !== 0 || old.y !== 0)) {
        n.x = old.x; n.y = old.y; n.vx = old.vx; n.vy = old.vy; n.pinned = old.pinned;
      } else if (saved) {
        n.x = Number(saved.pos_x); n.y = Number(saved.pos_y); n.pinned = !!saved.pinned;
      }
    }
    graphRef.current = built;
    if (layoutMode === 'force') setRunKey(k => k + 1);
    else applyStaticLayout(layoutMode, built);
    forceTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderClients, connections, positions === null, edgeToggles.referrals, edgeToggles.manual, edgeToggles.company, edgeToggles.school]);

  function applyStaticLayout(mode, graph = graphRef.current) {
    if (mode === 'radial') assignRadialLayout(graph.nodes, size.width, size.height);
    else if (mode === 'grid') assignGridLayout(graph.nodes, size.width, size.height);
    else if (mode === 'cluster') assignClusterLayout(graph.nodes, graph.edges, size.width, size.height);
    forceTick();
  }

  function switchLayout(mode) {
    setLayoutMode(mode);
    if (mode === 'force') setRunKey(k => k + 1);
    else applyStaticLayout(mode);
  }

  useForceSimulation(graphRef, {
    width: size.width, height: size.height,
    runKey: layoutMode === 'force' ? runKey : 0,
    onTick: forceTick,
  });

  // ---- derived: clusters, colors, filters, hover sets ----------------------
  const { nodes, edges, nodeById } = graphRef.current;

  const clusterLabels = useMemo(() => detectClusters(nodes, edges), [nodes, edges]);
  const clusters = useMemo(() => clusterMeta(nodes, clusterLabels), [nodes, clusterLabels]);
  const clusterColorByLabel = useMemo(() => new Map(clusters.map(c => [String(c.label), c.color])), [clusters]);

  const nodeColor = useCallback((n) => {
    if (colorMode === 'priority') return PRIORITY_COLORS[n.priority] || FALLBACK_NODE;
    if (colorMode === 'role') return ROLE_COLORS[n.role] || FALLBACK_NODE;
    if (colorMode === 'status') return STATUS_COLORS[n.status] || FALLBACK_NODE;
    return clusterColorByLabel.get(String(clusterLabels.get(n.id))) || FALLBACK_NODE;
  }, [colorMode, clusterLabels, clusterColorByLabel]);

  const filterActive = filterPriority !== 'all' || filterRole !== 'all' || filterStatus !== 'all';
  const passesFilter = useCallback((n) => {
    if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
    if (filterRole !== 'all' && n.role !== filterRole) return false;
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    return true;
  }, [filterPriority, filterRole, filterStatus]);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(nodes.filter(n =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.company || '').toLowerCase().includes(q) ||
      (n.school || '').toLowerCase().includes(q)
    ).map(n => n.id));
  }, [search, nodes]);

  const neighborSets = useMemo(() => {
    const m = new Map(nodes.map(n => [n.id, new Set()]));
    for (const e of edges) {
      m.get(e.source)?.add(e.target);
      m.get(e.target)?.add(e.source);
    }
    return m;
  }, [nodes, edges]);

  const focusId = hoverId ?? null;
  const focusSet = focusId ? new Set([focusId, ...(neighborSets.get(focusId) || [])]) : null;

  function nodeOpacity(n) {
    if (filterActive && !passesFilter(n)) return 0.1;
    if (highlightIds && !highlightIds.has(n.id)) return 0.15;
    if (searchMatches && !searchMatches.has(n.id)) return 0.15;
    if (focusSet && !focusSet.has(n.id)) return 0.18;
    return 1;
  }

  function edgeVisible(e) {
    const a = nodeById.get(e.source), b = nodeById.get(e.target);
    if (!a || !b) return false;
    if (filterActive && (!passesFilter(a) || !passesFilter(b))) return false; // filtered nodes' edges hide
    return true;
  }

  function edgeOpacity(e) {
    if (focusSet) return (e.source === focusId || e.target === focusId) ? 0.95 : 0.06;
    if (highlightIds) return (highlightIds.has(e.source) && highlightIds.has(e.target)) ? 0.9 : 0.06;
    if (searchMatches) return (searchMatches.has(e.source) || searchMatches.has(e.target)) ? 0.8 : 0.08;
    return e.type === 'company' || e.type === 'school' ? 0.45 : 0.75;
  }

  const insights = useMemo(() => computeInsights(nodes, edges, clusterLabels), [nodes, edges, clusterLabels]);

  // Frame search matches when a search lands
  useEffect(() => {
    if (!searchMatches || !searchMatches.size) return;
    frameNodes([...searchMatches].map(id => nodeById.get(id)).filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ---- pan / zoom -----------------------------------------------------------
  const panState = useRef(null);

  function clampZoom(k) { return Math.max(0.15, Math.min(4, k)); }

  function zoomAt(clientX, clientY, factor) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left, py = clientY - rect.top;
    setTransform(t => {
      const k = clampZoom(t.k * factor);
      const scale = k / t.k;
      return { k, x: px - (px - t.x) * scale, y: py - (py - t.y) * scale };
    });
  }

  function onWheel(e) {
    if (!interactive) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0018));
  }

  function frameNodes(list) {
    if (!list.length) return;
    const pad = 80;
    const xs = list.map(n => n.x), ys = list.map(n => n.y);
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const w = Math.max(maxX - minX, 60), h = Math.max(maxY - minY, 60);
    const k = clampZoom(Math.min(size.width / w, size.height / h));
    setTransform({ k, x: size.width / 2 - (minX + w / 2) * k, y: size.height / 2 - (minY + h / 2) * k });
  }

  const fitToScreen = () => frameNodes(nodes);

  function screenToWorld(clientX, clientY) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - transform.x) / transform.k, y: (clientY - rect.top - transform.y) / transform.k };
  }

  function onBackgroundPointerDown(e) {
    if (!interactive) return;
    panState.current = { startX: e.clientX, startY: e.clientY, ox: transform.x, oy: transform.y, moved: false };
    const move = (ev) => {
      const s = panState.current;
      if (!s) return;
      const dx = ev.clientX - s.startX, dy = ev.clientY - s.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) s.moved = true;
      setTransform(t => ({ ...t, x: s.ox + dx, y: s.oy + dy }));
    };
    const up = () => {
      if (panState.current && !panState.current.moved) {
        // plain background click clears selection / modes
        setSelectedId(null);
        setHighlightIds(null);
        if (drawFromId) { setDrawFromId(null); showToast('Connection drawing cancelled.'); }
      }
      panState.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- node dragging + position persistence --------------------------------
  function queuePositionSave(node) {
    dirtyPositions.current.set(node.id, { x: node.x, y: node.y, pinned: node.pinned });
    clearTimeout(posSaveTimer.current);
    posSaveTimer.current = setTimeout(async () => {
      const batch = [...dirtyPositions.current.entries()].map(([client_id, p]) => ({
        user_id: user.id, client_id, pos_x: Math.round(p.x * 100) / 100, pos_y: Math.round(p.y * 100) / 100, pinned: p.pinned,
      }));
      dirtyPositions.current.clear();
      if (!batch.length) return;
      const { error } = await supabase.from('graph_positions').upsert(batch, { onConflict: 'user_id,client_id' });
      if (error) showToast(`Could not save layout: ${error.message}`, 'error');
    }, 800);
  }

  function onNodePointerDown(e, node) {
    if (!interactive) return;
    e.stopPropagation();
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y, moved: false };
    node.pinned = true; // pinned during drag
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / transform.k;
      const dy = (ev.clientY - start.y) / transform.k;
      if (Math.abs(dx) + Math.abs(dy) > 2) start.moved = true;
      node.x = start.nx + dx;
      node.y = start.ny + dy;
      forceTick();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (start.moved) {
        queuePositionSave(node); // stays pinned where dropped
        forceTick();
      } else {
        node.pinned = false;
        handleNodeClick(node);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function togglePin(node) {
    node.pinned = !node.pinned;
    queuePositionSave(node);
    forceTick();
  }

  // ---- selection & connection drawing ---------------------------------------
  function handleNodeClick(node) {
    if (drawFromId && drawFromId !== node.id) {
      setPendingConn({ fromId: drawFromId, toId: node.id });
      setDrawFromId(null);
      return;
    }
    setSelectedId(node.id);
    setHighlightIds(null);
  }

  async function createConnection(fromId, toId, type, strength) {
    setPendingConn(null);
    const optimistic = { id: `tmp-${Date.now()}`, user_id: user.id, from_client_id: fromId, to_client_id: toId, relationship_type: type, strength };
    setConnections(prev => [...prev, optimistic]);
    const { data, error } = await supabase.from('relationship_connections')
      .insert([{ user_id: user.id, from_client_id: fromId, to_client_id: toId, relationship_type: type, strength }])
      .select();
    if (error) {
      setConnections(prev => prev.filter(c => c.id !== optimistic.id));
      showToast(error.message.includes('duplicate') ? 'Those two are already connected that way.' : error.message, 'error');
    } else {
      setConnections(prev => prev.map(c => c.id === optimistic.id ? data[0] : c));
      showToast(`Connected ${nodeById.get(fromId)?.name || ''} ↔ ${nodeById.get(toId)?.name || ''}.`, 'success');
    }
  }

  async function deleteConnection(connId) {
    const old = connections;
    setConnections(prev => prev.filter(c => c.id !== connId));
    const { error } = await supabase.from('relationship_connections').delete().eq('id', connId);
    if (error) { setConnections(old); showToast(error.message, 'error'); }
    else showToast('Connection removed.');
  }

  // Re-layout: clear saved positions + restart the simulation cold
  async function relayout() {
    for (const n of nodes) { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; n.pinned = false; }
    setLayoutMode('force');
    setRunKey(k => k + 1);
    const { error } = await supabase.from('graph_positions').delete().eq('user_id', user.id);
    if (error) showToast(error.message, 'error');
    else setPositions([]);
  }

  // ---- 1.9 export ------------------------------------------------------------
  async function exportPng() {
    const svgEl = svgRef.current;
    if (!svgEl || exporting) return;
    setExporting(true);
    try {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('width', size.width);
      clone.setAttribute('height', size.height);
      // inline a background so the PNG isn't transparent
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#F9FAFB');
      clone.insertBefore(bg, clone.firstChild);
      // text elements rely on CSS classes — inline a readable fill
      clone.querySelectorAll('text').forEach(t => { if (!t.getAttribute('fill')) t.setAttribute('fill', '#374151'); });
      const xml = new XMLSerializer().serializeToString(clone);
      const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = size.width * 2; // 2× resolution
      canvas.height = size.height * 2 + 120;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F9FAFB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 120, canvas.width, canvas.height - 120);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText('My Professional Network', 40, 66);
      ctx.fillStyle = '#6B7280';
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillText(`${nodes.length} people · ${edges.length} connections · ${new Date().toLocaleDateString()}`, 40, 102);
      URL.revokeObjectURL(svgUrl);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `my-network-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
      showToast('Network exported as PNG.', 'success');
    } catch {
      showToast('PNG export failed — try again after the layout settles.', 'error');
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['From', 'To', 'Type', 'Weight'].join(',')];
    for (const e of edges) {
      rows.push([esc(nodeById.get(e.source)?.name), esc(nodeById.get(e.target)?.name), esc(EDGE_STYLES[e.type]?.label || e.type), e.weight ?? 1].join(','));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'network-connections.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Connections exported as CSV.', 'success');
  }

  // ---- render helpers ---------------------------------------------------------
  const useCurves = curvedEdges && nodes.length <= CURVES_OFF_ABOVE;
  const useShadows = nodes.length <= CURVES_OFF_ABOVE;

  function edgePath(e) {
    const a = nodeById.get(e.source), b = nodeById.get(e.target);
    if (!a || !b) return '';
    if (!useCurves) return `M${a.x},${a.y}L${b.x},${b.y}`;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // control point offset perpendicular to the line — a slight arc
    const off = Math.min(len * 0.12, 26);
    return `M${a.x},${a.y}Q${mx - (dy / len) * off},${my + (dx / len) * off} ${b.x},${b.y}`;
  }

  const selectedNode = selectedId ? nodeById.get(selectedId) : null;
  const selectedClient = selectedNode ? clients.find(c => c.id === selectedId) : null;

  // ---- guards -----------------------------------------------------------------
  if (connections === null || positions === null) return <GraphSkeleton />;
  if (!clients.length) return <GraphEmpty onAdd={onAddRelationship} />;

  const visibleEdges = edges.filter(edgeVisible);
  const priorityOptions = ['High', 'Medium', 'Low'];
  const roleOptions = [...new Set(clients.map(c => c.network_role).filter(Boolean))];
  const statusOptions = [...new Set(clients.map(c => c.status).filter(Boolean))];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[560px] -mx-1">
      {/* ============ 1.1 HEADER: counts, filters, search, layout, export ============ */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="mr-2">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">Network</h1>
          <p className="text-[12px] text-gray-500">{nodes.length} {nodes.length === 1 ? 'person' : 'people'} · {edges.length} {edges.length === 1 ? 'connection' : 'connections'}</p>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, company, school…"
          className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-1.5 text-[12.5px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400 w-52"
        />

        <select value={colorMode} onChange={e => setColorMode(e.target.value)} title="Color nodes by"
          className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
          <option value="priority">Color: Priority</option>
          <option value="role">Color: Network role</option>
          <option value="status">Color: Stage</option>
          <option value="cluster">Color: Cluster</option>
        </select>

        <select value={layoutMode} onChange={e => switchLayout(e.target.value)} title="Layout"
          className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
          <option value="force">Layout: Force</option>
          <option value="radial">Layout: Radial</option>
          <option value="grid">Layout: Grid</option>
          <option value="cluster">Layout: By company</option>
        </select>

        <div className="flex items-center gap-1 text-[11px] font-semibold">
          {[['referrals', 'Referrals'], ['manual', 'Manual'], ['company', 'Company'], ['school', 'School']].map(([k, label]) => (
            <button key={k} onClick={() => setEdgeToggles(t => ({ ...t, [k]: !t[k] }))}
              className={`px-2 py-1 rounded-lg border transition-colors ${edgeToggles[k]
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setInsightsOpen(v => !v)} className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border ${insightsOpen ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Insights</button>
          <button onClick={relayout} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800" title="Clear saved positions and re-run the simulation">Re-layout</button>
          <button onClick={exportCsv} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">CSV</button>
          <button onClick={exportPng} disabled={exporting} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:opacity-90 disabled:opacity-50">{exporting ? 'Exporting…' : 'Export PNG'}</button>
        </div>
      </div>

      {/* secondary filter row */}
      <div className="flex flex-wrap items-center gap-2 pb-3 text-[12px]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Filter</span>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
          <option value="all">Any priority</option>
          {priorityOptions.map(p => <option key={p} value={p}>{p} priority</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
          <option value="all">Any role</option>
          {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
          <option value="all">Any stage</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterActive || search || highlightIds) && (
          <button onClick={() => { setFilterPriority('all'); setFilterRole('all'); setFilterStatus('all'); setSearch(''); setHighlightIds(null); }}
            className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Clear all</button>
        )}
        <label className="flex items-center gap-1.5 ml-auto text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={curvedEdges} onChange={e => setCurvedEdges(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
          Curved edges
        </label>
        {capped && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Showing your {MAX_RENDERED_NODES} most-connected relationships</span>}
        {loadError && <span className="text-[11px] text-red-600 font-medium">Connections failed to load: {loadError}</span>}
      </div>

      {clients.length < 3 && (
        <p className="text-[12px] text-gray-400 pb-2">Add more relationships and connections to see your network take shape.</p>
      )}

      {/* ============ THE CANVAS ============ */}
      <div ref={containerRef} className="relative flex-1 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 overflow-hidden">
        {!interactive && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-gray-900/85 text-white text-[11px] font-medium">
            Read-only preview — the interactive graph is best on desktop
          </div>
        )}
        {drawFromId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold shadow-lg">
            Click another person to connect them to {nodeById.get(drawFromId)?.name} — click empty space to cancel
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full touch-none select-none"
          onWheel={onWheel}
          onPointerDown={onBackgroundPointerDown}
          style={{ cursor: drawFromId ? 'crosshair' : 'grab' }}
          role="img"
          aria-label="Interactive network graph"
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* edges under nodes */}
            {visibleEdges.map((e, i) => {
              const st = EDGE_STYLES[e.type] || EDGE_STYLES.knows;
              return (
                <path key={e.connId ?? `${e.source}-${e.target}-${e.type}-${i}`}
                  d={edgePath(e)}
                  fill="none"
                  stroke={st.stroke}
                  strokeWidth={(e.type === 'referred' ? st.width : Math.min(st.width * (e.weight || 1), 4)) / Math.sqrt(transform.k)}
                  strokeDasharray={st.dash || undefined}
                  strokeLinecap="round"
                  opacity={edgeOpacity(e)}
                />
              );
            })}

            {/* nodes */}
            {nodes.map(n => {
              const r = 8 + Math.min(n.degree * 2, 20);
              const color = nodeColor(n);
              const op = nodeOpacity(n);
              const isSelected = n.id === selectedId;
              const isHover = n.id === hoverId;
              const isSearchHit = searchMatches?.has(n.id);
              const ringColor = PRIORITY_COLORS[n.priority] || '#D1D5DB';
              return (
                <g key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={op}
                  onPointerDown={e => onNodePointerDown(e, n)}
                  onPointerEnter={() => interactive && setHoverId(n.id)}
                  onPointerLeave={() => setHoverId(h => (h === n.id ? null : h))}
                  style={{ cursor: interactive ? 'pointer' : 'default' }}
                >
                  {isSearchHit && (
                    <circle r={r + 8} fill="none" stroke="#6366F1" strokeWidth={2} opacity={0.8}>
                      <animate attributeName="r" values={`${r + 4};${r + 12};${r + 4}`} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {isSelected && <circle r={r + 5} fill="none" stroke="#F59E0B" strokeWidth={2.5} />}
                  <circle
                    r={isHover ? r * 1.15 : r}
                    fill={color}
                    stroke={ringColor}
                    strokeWidth={2}
                    style={useShadows ? { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' } : undefined}
                  />
                  {n.pinned && <circle r={2.5} cy={-r - 4} fill="#F59E0B" />}
                  <text textAnchor="middle" dy=".34em" fontSize={n.emoji ? r * 0.95 : Math.max(r * 0.62, 8)}
                    fill="#fff" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    {n.emoji || initialsOf(n.name)}
                  </text>
                  {(transform.k > 0.55 || isHover || isSelected) && (
                    <text textAnchor="middle" y={r + 13} fontSize={11 / Math.max(transform.k, 0.7)}
                      className="fill-gray-600 dark:fill-gray-300" fontWeight="600" style={{ pointerEvents: 'none' }}>
                      {n.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          {[['+', () => zoomAt(size.width / 2, size.height / 2, 1.3)],
            ['−', () => zoomAt(size.width / 2, size.height / 2, 1 / 1.3)],
            ['Fit', fitToScreen]].map(([label, fn]) => (
            <button key={label} onClick={fn}
              className="w-9 h-9 grid place-items-center text-[13px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              {label}
            </button>
          ))}
        </div>

        {/* edge-type legend + cluster legend */}
        {legendOpen && (
          <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-[11px] space-y-1 max-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold uppercase tracking-wider text-gray-400 text-[10px]">Legend</span>
              <button onClick={() => setLegendOpen(false)} className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-300">×</button>
            </div>
            {[['referred'], ['knows'], ['company'], ['school']].map(([t]) => (
              <div key={t} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke={EDGE_STYLES[t].stroke} strokeWidth={EDGE_STYLES[t].width} strokeDasharray={EDGE_STYLES[t].dash || undefined} /></svg>
                {t === 'knows' ? 'Manual connection' : EDGE_STYLES[t].label}
              </div>
            ))}
            {colorMode === 'cluster' && clusters.filter(c => c.size > 1).slice(0, 6).map((c, i) => (
              <button key={c.label} onClick={() => { setHighlightIds(new Set(c.ids)); frameNodes(c.ids.map(id => nodeById.get(id)).filter(Boolean)); }}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white w-full text-left">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                Cluster {i + 1}: {c.size} people{c.descriptor ? `, ${c.descriptor}` : ''}
              </button>
            ))}
          </div>
        )}
        {!legendOpen && (
          <button onClick={() => setLegendOpen(true)} className="absolute bottom-3 left-3 px-2.5 py-1.5 text-[11px] font-semibold bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500">Legend</button>
        )}

        {/* ============ 1.8 INSIGHTS PANEL ============ */}
        {insightsOpen && (
          <div className="absolute top-3 left-3 w-72 max-h-[calc(100%-24px)] overflow-y-auto p-4 rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-700 shadow-xl space-y-4 text-[12.5px]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Network insights</h3>
              <button onClick={() => setInsightsOpen(false)} className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-300">×</button>
            </div>

            <div>
              <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">Most connected</p>
              {insights.mostConnected.length === 0 && <p className="text-gray-400">No connections yet — draw one from any profile panel.</p>}
              {insights.mostConnected.map(n => (
                <button key={n.id} onClick={() => { setSelectedId(n.id); setHighlightIds(new Set([n.id, ...(neighborSets.get(n.id) || [])])); frameNodes([n, ...[...(neighborSets.get(n.id) || [])].map(id => nodeById.get(id))].filter(Boolean)); }}
                  className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-0.5">
                  {n.name} — {n.degree} connection{n.degree === 1 ? '' : 's'}
                </button>
              ))}
            </div>

            <div>
              <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">Isolated contacts</p>
              {insights.isolated.length === 0 ? (
                <p className="text-gray-400">Everyone is connected to someone. Nice.</p>
              ) : (
                <button onClick={() => setHighlightIds(new Set(insights.isolated.map(n => n.id)))}
                  className="text-left text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  {insights.isolated.length} {insights.isolated.length === 1 ? 'person isn’t' : 'people aren’t'} connected to anyone — consider introductions. Click to highlight.
                </button>
              )}
            </div>

            <div>
              <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">Bridges</p>
              {insights.bridges.length === 0 && <p className="text-gray-400">No bridge people yet — bridges connect otherwise-separate groups.</p>}
              {insights.bridges.map(n => (
                <button key={n.id} onClick={() => { setSelectedId(n.id); setHighlightIds(new Set([n.id, ...(neighborSets.get(n.id) || [])])); }}
                  className="block w-full text-left text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-0.5">
                  {n.name} — links {new Set([...(neighborSets.get(n.id) || [])].map(id => String(clusterLabels.get(id)))).size} groups
                </button>
              ))}
            </div>

            <div className="pt-1 border-t border-gray-100 dark:border-gray-800 text-gray-500 space-y-1">
              <p>Largest cluster: <span className="font-semibold text-gray-800 dark:text-gray-200">{insights.largestCluster} people</span></p>
              <p>Longest referral chain reach: <span className="font-semibold text-gray-800 dark:text-gray-200">{insights.reach || 0} people</span></p>
            </div>
          </div>
        )}

        {/* ============ 1.6 NODE DETAIL PANEL ============ */}
        {selectedNode && selectedClient && (
          <div className="absolute top-0 right-0 h-full w-80 bg-white/97 dark:bg-gray-900/97 backdrop-blur border-l border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full grid place-items-center text-white font-bold text-[15px]" style={{ background: nodeColor(selectedNode) }}>
                    {selectedNode.emoji || initialsOf(selectedNode.name)}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">{selectedNode.name}</h3>
                    {selectedClient.company_name && (
                      <a href={selectedClient.company_url || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(selectedClient.company_name)}`}
                        target="_blank" rel="noopener noreferrer" className="text-[12px] text-indigo-600 dark:text-indigo-400 hover:underline">
                        {selectedClient.company_name}
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 text-[16px] leading-none">×</button>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10.5px] font-bold">
                {selectedNode.role && <span className="px-2 py-0.5 rounded-full text-white" style={{ background: ROLE_COLORS[selectedNode.role] || FALLBACK_NODE }}>{selectedNode.role}</span>}
                {selectedNode.priority && <span className="px-2 py-0.5 rounded-full text-white" style={{ background: PRIORITY_COLORS[selectedNode.priority] }}>{selectedNode.priority} priority</span>}
                {selectedNode.status && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{selectedNode.status}</span>}
                {selectedNode.school && <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">{selectedNode.school}</span>}
              </div>

              {/* direct connections */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Connections ({selectedNode.degree})</p>
                {selectedNode.degree === 0 && <p className="text-[12px] text-gray-400">Not connected to anyone yet.</p>}
                <div className="space-y-1">
                  {edges.filter(e => e.source === selectedId || e.target === selectedId).slice(0, 14).map((e, i) => {
                    const otherId = e.source === selectedId ? e.target : e.source;
                    const other = nodeById.get(otherId);
                    if (!other) return null;
                    const st = EDGE_STYLES[e.type] || EDGE_STYLES.knows;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12.5px] group">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.stroke }} title={st.label} />
                        <button onClick={() => { setSelectedId(otherId); frameNodes([other]); }}
                          className="text-gray-700 dark:text-gray-200 font-medium hover:underline truncate">{other.name}</button>
                        <span className="text-[10.5px] text-gray-400 shrink-0">{st.label.toLowerCase()}</span>
                        {e.connId && typeof e.connId !== 'string' && (
                          <button onClick={() => deleteConnection(e.connId)} title="Remove connection"
                            className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 shrink-0">×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* open deals */}
              {(() => {
                const open = (deals || []).filter(d => d.client_id === selectedId && !['Won', 'Lost'].includes(d.stage));
                if (!open.length) return null;
                return (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Open deals</p>
                    {open.map(d => (
                      <p key={d.id} className="text-[12.5px] text-gray-700 dark:text-gray-200">
                        <span className="font-semibold">{d.title}</span> — ${Number(d.value || 0).toLocaleString()} · {d.stage}
                      </p>
                    ))}
                  </div>
                );
              })()}

              {/* last activity */}
              {(() => {
                const last = (activities || []).filter(a => a.client_id === selectedId)
                  .sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || ''))[0];
                return (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Last activity</p>
                    {last ? (
                      <p className="text-[12.5px] text-gray-600 dark:text-gray-300">
                        <span className="font-semibold">{last.activity_type}</span> · {relTime(last.activity_date)} — {(last.description || '').slice(0, 90)}
                      </p>
                    ) : <p className="text-[12px] text-gray-400">Nothing logged yet.</p>}
                  </div>
                );
              })()}

              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => onOpenClient(selectedClient)} className="w-full px-3 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Open full profile</button>
                <button onClick={() => onOpenClient(selectedClient, { tab: 'activity' })} className="w-full px-3 py-2 text-[13px] font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">Log activity</button>
                <button onClick={() => { setDrawFromId(selectedId); setSelectedId(null); }} className="w-full px-3 py-2 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40">Draw connection from here</button>
                <button onClick={() => togglePin(selectedNode)} className="w-full px-3 py-2 text-[12px] font-semibold text-gray-500 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
                  {selectedNode.pinned ? 'Unpin position' : 'Pin in place'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ CONNECTION TYPE PICKER ============ */}
        {pendingConn && (
          <div className="absolute inset-0 z-20 bg-black/30 flex items-center justify-center p-4" onClick={() => setPendingConn(null)}>
            <div className="w-full max-w-xs bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">
                {nodeById.get(pendingConn.fromId)?.name} ↔ {nodeById.get(pendingConn.toId)?.name}
              </h3>
              <p className="text-[12px] text-gray-500 mb-3">How do they know each other?</p>
              <div className="space-y-1.5">
                {MANUAL_TYPES.map(t => (
                  <button key={t} onClick={() => createConnection(pendingConn.fromId, pendingConn.toId, t, 2)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-400 dark:hover:border-gray-500 text-left">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: EDGE_STYLES[t].stroke }} />
                    {EDGE_STYLES[t].label}
                  </button>
                ))}
              </div>
              <button onClick={() => setPendingConn(null)} className="mt-3 w-full text-[12px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
