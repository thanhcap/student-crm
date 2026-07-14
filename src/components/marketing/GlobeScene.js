'use client';
// V9 — THE centerpiece: a stylized dark Earth with people-nodes orbiting it,
// connected by curved arcs. Interactive: drag to spin (OrbitControls), hover a
// node for its name. Load only via dynamic({ ssr: false }) and never on mobile
// or under prefers-reduced-motion (the caller gates this).
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, OrbitControls, Html } from '@react-three/drei';
import { useRef, useMemo, useState, Suspense } from 'react';
import * as THREE from 'three';

// -- THE EARTH --
function Earth() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.04;
  });
  return (
    <group ref={ref}>
      {/* dark stylized sphere — not a photo texture */}
      <Sphere args={[2.2, 64, 64]}>
        <meshStandardMaterial color="#0C1222" roughness={0.7} metalness={0.3}
                              emissive="#1a1a4e" emissiveIntensity={0.15} />
      </Sphere>
      {/* wireframe overlay — the tech/futuristic feel */}
      <Sphere args={[2.22, 32, 32]}>
        <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.08} />
      </Sphere>
      {/* atmosphere glow */}
      <Sphere args={[2.35, 64, 64]}>
        <meshBasicMaterial color="#06B6D4" transparent opacity={0.04} side={THREE.BackSide} />
      </Sphere>
    </group>
  );
}

// -- PEOPLE NODES orbiting the Earth --
// The parent <group> (owned by GlobeScene, shared with the connection lines)
// carries the orbital motion so lines can track node positions each frame.
function PersonNode({ groupRef, position, color, name, delay }) {
  const [hovered, setHovered] = useState(false);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + delay;
    const g = groupRef.current;
    if (!g) return;
    const radius = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
    const speed = 0.12 / (radius * 0.3); // farther = slower, feels natural
    g.position.x = Math.cos(t * speed) * position[0] - Math.sin(t * speed) * position[2];
    g.position.z = Math.sin(t * speed) * position[0] + Math.cos(t * speed) * position[2];
    g.position.y = position[1] + Math.sin(t * 0.5) * 0.15; // gentle bob
  });
  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <Sphere args={[0.18, 24, 24]}>
        <meshStandardMaterial color={color} emissive={color}
                              emissiveIntensity={hovered ? 0.6 : 0.2}
                              roughness={0.2} metalness={0.8} />
      </Sphere>
      {hovered && (
        <>
          <Sphere args={[0.28, 16, 16]}>
            <meshBasicMaterial color={color} transparent opacity={0.15} />
          </Sphere>
          <Html center distanceFactor={8}>
            <div className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-white whitespace-nowrap pointer-events-none">
              {name}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

// -- CONNECTION ARCS between people (curved outward from Earth's center) --
function ConnectionLine({ personARef, personBRef, color = '#8B5CF6' }) {
  const lineRef = useRef();
  useFrame(() => {
    if (!personARef.current || !personBRef.current || !lineRef.current) return;
    const a = personARef.current.position;
    const b = personBRef.current.position;
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
    mid.normalize().multiplyScalar(Math.max(mid.length() * 1.15, 2.6)); // arc above the surface
    lineRef.current.geometry.setFromPoints(
      new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone()).getPoints(32)
    );
  });
  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial color={color} transparent opacity={0.3} />
    </line>
  );
}

// PLACEHOLDER names — swap for real community members / testimonials later.
const PEOPLE = [
  { name: 'Sarah C.',  pos: [3.2, 1.0, 1.5],   color: '#8B5CF6', delay: 0 },
  { name: 'James L.',  pos: [-2.8, 1.8, 2.0],  color: '#06B6D4', delay: 1.2 },
  { name: 'Aiko T.',   pos: [2.5, -1.2, -2.5], color: '#F59E0B', delay: 2.4 },
  { name: 'Marcus W.', pos: [-3.5, -0.8, -1.0], color: '#10B981', delay: 0.8 },
  { name: 'Elena R.',  pos: [1.8, 2.5, 2.8],   color: '#EC4899', delay: 1.8 },
  { name: 'David K.',  pos: [-2.0, -2.0, 3.0], color: '#3B82F6', delay: 3.0 },
  { name: 'Priya S.',  pos: [3.8, 0.2, -1.8],  color: '#F97316', delay: 0.4 },
  { name: 'Omar H.',   pos: [-1.5, 2.8, -2.2], color: '#14B8A6', delay: 2.0 },
  { name: 'Lisa M.',   pos: [0.5, -2.8, 3.2],  color: '#A855F7', delay: 1.0 },
  { name: 'Thanh C.',  pos: [-3.0, 0.0, 0.9],  color: '#FBBF24', delay: 0.2 },
];

// Selective network — everyone-to-everyone reads as chaos.
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [3, 5],
  [6, 0], [7, 1], [8, 2], [9, 4], [6, 9], [7, 8],
];

export default function GlobeScene({ interactive = true, small = false }) {
  const personRefs = useMemo(() => PEOPLE.map(() => ({ current: null })), []);
  return (
    <Canvas camera={{ position: [0, 0, small ? 12 : 10], fov: 45 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 8, 8]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-8, -5, 5]} intensity={0.6} color="#8B5CF6" />
        <pointLight position={[5, -8, -5]} intensity={0.4} color="#06B6D4" />

        <Earth />

        {PEOPLE.map((p, i) => (
          <group key={i} ref={el => (personRefs[i].current = el)}>
            <PersonNode groupRef={personRefs[i]} position={p.pos} color={p.color} name={p.name} delay={p.delay} />
          </group>
        ))}

        {CONNECTIONS.map(([a, b], i) => (
          <ConnectionLine key={`c${i}`} personARef={personRefs[a]} personBRef={personRefs[b]} color={PEOPLE[a].color} />
        ))}

        {/* drag to spin; zoom/pan locked so the scene can't be broken */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={interactive}
          rotateSpeed={0.4}
          autoRotate
          autoRotateSpeed={0.3}
          minPolarAngle={Math.PI * 0.35}
          maxPolarAngle={Math.PI * 0.65}
        />
      </Suspense>
    </Canvas>
  );
}

// Static CSS fallback — same footprint, no WebGL, no layout shift.
export function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-[70%] max-w-[480px] aspect-square rounded-full opacity-40"
           style={{ background: 'radial-gradient(circle at 30% 30%, #1a1a4e, #06060F 70%)',
                    boxShadow: '0 0 120px 40px rgba(139,92,246,0.08), inset 0 0 60px rgba(6,182,212,0.06)' }} />
    </div>
  );
}
