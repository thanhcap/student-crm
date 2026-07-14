'use client';
// V10 — THE hero: a photorealistic NASA-textured Earth with people as
// billboarded avatar circles orbiting it, connected by curved arcs with
// traveling pulse dots. Google Earth behavior: drag to spin, slow idle
// rotation. Space environment via drei <Stars>. Load only through
// dynamic({ ssr:false }); callers gate to desktop + no-reduced-motion.
// Props: interactive (drag on/off), small (reprise scale on pricing/features).
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Preload } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import RealisticEarth from './RealisticEarth';
import ConnectionNode from './ConnectionNode';
import { ConnectionArc, PulseDot } from './ConnectionLines';

// PLACEHOLDER people — the founder swaps interiors for emoji/icons/photos
// (see ConnectionNode.js) and names for real community members later.
const PEOPLE = [
  { label: 'Sarah Chen · Product Lead', initials: 'SC', pos: [3.6, 1.2, 1.0],   color: '#8B5CF6', delay: 0 },
  { label: 'James Liu · Engineer',      initials: 'JL', pos: [-3.2, 1.5, 2.2],  color: '#06B6D4', delay: 1.4 },
  { label: 'Aiko Tanaka · Designer',    initials: 'AT', pos: [2.8, -1.0, -2.8], color: '#F59E0B', delay: 2.6 },
  { label: 'Marcus Weber · Founder',    initials: 'MW', pos: [-3.8, -0.6, -1.2], color: '#10B981', delay: 0.9 },
  { label: 'Elena Rivera · Marketing',  initials: 'ER', pos: [2.0, 2.6, 2.5],   color: '#EC4899', delay: 1.7 },
  { label: 'David Kim · Investor',      initials: 'DK', pos: [-2.2, -2.0, 3.2], color: '#3B82F6', delay: 3.1 },
  { label: 'Priya Sharma · Advisor',    initials: 'PS', pos: [4.0, 0.3, -1.5],  color: '#F97316', delay: 0.5 },
  { label: 'Omar Hassan · Partner',     initials: 'OH', pos: [-1.8, 2.8, -2.0], color: '#14B8A6', delay: 2.2 },
  { label: 'Lisa Morgan · Mentor',      initials: 'LM', pos: [0.8, -3.0, 3.5],  color: '#A855F7', delay: 1.1 },
  { label: 'Thanh Cap · You',           initials: 'TC', pos: [-3.4, 0.0, 0.9],  color: '#FBBF24', delay: 0.3 },
];

// Selective, story-shaped network: the founder (TC) hubs out to key people,
// who connect onward. Everyone-to-everyone reads as chaos.
const CONNECTIONS = [
  [9, 0], [9, 1], [9, 4], [9, 6],
  [0, 1], [0, 2], [1, 3], [4, 5],
  [6, 7], [2, 8], [3, 5], [7, 8],
];

export default function GlobeScene({ interactive = true, small = false }) {
  const nodeRefs = useMemo(() => PEOPLE.map(() => ({ current: null })), []);

  return (
    <Canvas
      camera={{ position: [0, 0.5, small ? 11 : 8], fov: 48 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        {/* SPACE ENVIRONMENT */}
        <Stars radius={100} depth={60} count={2500} factor={4} saturation={0} fade speed={0.5} />
        <ambientLight intensity={0.25} />
        {/* keyed toward the camera so the visible hemisphere is the bright, vivid one */}
        <directionalLight position={[5, 3, 8]} intensity={2.4} color="#ffffff" />
        <pointLight position={[-8, -4, 3]} intensity={0.4} color="#8B5CF6" />

        {/* THE EARTH — photorealistic, NASA Blue Marble */}
        <RealisticEarth radius={2.5} />

        {/* PEOPLE — billboarded avatar circles orbiting the Earth */}
        {PEOPLE.map((p, i) => (
          <group key={i} ref={el => (nodeRefs[i].current = el)}>
            <ConnectionNode groupRef={nodeRefs[i]} position={p.pos} color={p.color}
                            label={p.label} initials={p.initials} delay={p.delay} />
          </group>
        ))}

        {/* ARCS + PULSE DOTS between circles */}
        {CONNECTIONS.map(([a, b], i) => (
          <group key={`arc-${i}`}>
            <ConnectionArc nodeRefA={nodeRefs[a]} nodeRefB={nodeRefs[b]} color={PEOPLE[a].color} />
            <PulseDot nodeRefA={nodeRefs[a]} nodeRefB={nodeRefs[b]} color={PEOPLE[a].color} speed={0.15 + i * 0.02} />
          </group>
        ))}

        {/* Google Earth grab-and-spin; zoom/pan locked */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={interactive}
          rotateSpeed={0.5}
          autoRotate
          autoRotateSpeed={0.25}
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.7}
        />

        <Preload all />
      </Suspense>
    </Canvas>
  );
}

// Static CSS fallback — an earth-toned sphere silhouette, no WebGL.
export function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-[70%] max-w-[400px] aspect-square rounded-full"
           style={{
             background: 'radial-gradient(circle at 35% 35%, #1a4a8a, #0a1628 70%)',
             boxShadow: '0 0 100px 30px rgba(77,166,255,0.08), inset 0 0 60px rgba(77,166,255,0.05)',
           }} />
    </div>
  );
}
