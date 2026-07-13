'use client';
// V6 Part 6 — the landing hero: a slowly breathing constellation of sequence nodes
// with light pulses traveling the edges ("your campaign, running"). Thematically the
// campaign canvas, not decorative geometry. Loaded via next/dynamic({ssr:false}).
// Note: dropped drei's <Environment preset="city"> (fetches an external HDR that would
// suspend forever if blocked) in favor of an extra point light — self-contained.
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sphere, MeshDistortMaterial } from '@react-three/drei';
import { useRef, Suspense } from 'react';

const NODES = [
  { p: [0.0, 2.1, 0.0], c: '#8b5cf6' },   // trigger
  { p: [0.0, 0.8, 0.3], c: '#3b82f6' },   // email
  { p: [0.0, -0.5, 0.0], c: '#a1a1aa' },  // wait
  { p: [0.0, -1.8, 0.3], c: '#f59e0b' },  // condition
  { p: [-1.9, -3.0, 0.0], c: '#14b8a6' }, // goal (yes)
  { p: [1.9, -3.0, 0.0], c: '#6366f1' },  // linkedin (no)
];
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]];

function Node({ position, color, phase }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(t * 1.2 + phase) * 0.06);
  });
  return (
    <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.5}>
      <Sphere ref={ref} args={[0.3, 48, 48]} position={position}>
        {/* Low metalness + emissive so nodes read as their campaign colors without an
            environment map (we dropped drei's <Environment> to stay self-contained). */}
        <MeshDistortMaterial color={color} emissive={color} emissiveIntensity={0.5}
                             distort={0.22} speed={1.4} roughness={0.35} metalness={0.2} />
      </Sphere>
    </Float>
  );
}

// Light pulses traveling along each edge — "the campaign is running right now"
function Pulses() {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    EDGES.forEach(([a, b], i) => {
      const m = refs.current[i];
      if (!m) return;
      const k = (t * 0.28 + i * 0.19) % 1;
      const A = NODES[a].p, B = NODES[b].p;
      m.position.set(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
      m.material.opacity = Math.sin(k * Math.PI);
    });
  });
  return EDGES.map((_, i) => (
    <mesh key={i} ref={el => { refs.current[i] = el; }}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} />
    </mesh>
  ));
}

function Graph() {
  const g = useRef();
  useFrame(({ clock, pointer }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime();
    g.current.rotation.y = Math.sin(t * 0.15) * 0.3 + pointer.x * 0.25;
    g.current.rotation.x = Math.cos(t * 0.12) * 0.08 - pointer.y * 0.12;
  });
  return (
    <group ref={g}>
      {EDGES.map(([a, b], i) => (
        <Line key={i} points={[NODES[a].p, NODES[b].p]} color="#71717a" lineWidth={1} transparent opacity={0.3} />
      ))}
      {NODES.map((n, i) => <Node key={i} position={n.p} color={n.c} phase={i * 0.7} />)}
      <Pulses />
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas camera={{ position: [0, -0.4, 7.5], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <pointLight position={[6, 6, 6]} intensity={1.3} />
        <pointLight position={[-6, -3, 2]} intensity={0.6} color="#8b5cf6" />
        <pointLight position={[0, 2, 5]} intensity={0.5} color="#3b82f6" />
        <Graph />
      </Suspense>
    </Canvas>
  );
}
