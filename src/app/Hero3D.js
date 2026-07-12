'use client';
// V5 Part E — 3D hero: a slowly rotating campaign graph with light pulses traveling
// the edges ("the sequence is running"). Thematically the product, not decoration.
// Loaded via next/dynamic({ ssr: false }) ONLY on desktop and only when the visitor
// doesn't prefer reduced motion — three.js never enters the initial bundle.
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sphere, MeshDistortMaterial } from '@react-three/drei';
import { useRef, useMemo, Suspense } from 'react';

function SequenceNode3D({ position, color, pulse = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      const s = 1 + Math.sin(t * 1.5 + pulse) * 0.08;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
      <Sphere ref={ref} args={[0.28, 32, 32]} position={position}>
        <MeshDistortMaterial color={color} distort={0.25} speed={1.6} roughness={0.15} metalness={0.85} />
      </Sphere>
    </Float>
  );
}

// Small glowing dots that travel along each edge
function PulseTravellers({ edges }) {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    edges.forEach((e, i) => {
      const m = refs.current[i];
      if (!m) return;
      const k = (t * 0.35 + i * 0.25) % 1; // 0→1 progress along the edge
      m.position.set(
        e[0][0] + (e[1][0] - e[0][0]) * k,
        e[0][1] + (e[1][1] - e[0][1]) * k,
        e[0][2] + (e[1][2] - e[0][2]) * k,
      );
    });
  });
  return edges.map((_, i) => (
    <mesh key={`p${i}`} ref={el => { refs.current[i] = el; }}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  ));
}

function SequenceGraph3D() {
  // The campaign graph shape: trigger → email → wait → condition → yes/no branches
  const nodes = useMemo(() => [
    { p: [0.0, 1.9, 0], c: '#a855f7' },   // trigger  (purple)
    { p: [0.0, 0.7, 0], c: '#3b82f6' },   // email    (blue)
    { p: [0.0, -0.5, 0], c: '#9ca3af' },  // wait     (gray)
    { p: [0.0, -1.7, 0], c: '#f59e0b' },  // condition(amber)
    { p: [-1.7, -2.9, 0], c: '#10b981' }, // yes → goal (green)
    { p: [1.7, -2.9, 0], c: '#6366f1' },  // no  → linkedin (indigo)
  ], []);
  const edges = useMemo(() => [
    [nodes[0].p, nodes[1].p], [nodes[1].p, nodes[2].p], [nodes[2].p, nodes[3].p],
    [nodes[3].p, nodes[4].p], [nodes[3].p, nodes[5].p],
  ], [nodes]);

  const group = useRef();
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.18) * 0.35;
  });

  return (
    <group ref={group} position={[0, 0.5, 0]}>
      {edges.map((e, i) => (
        <Line key={`e${i}`} points={e} color="#64748b" lineWidth={1} transparent opacity={0.35} />
      ))}
      {nodes.map((n, i) => (
        <SequenceNode3D key={`n${i}`} position={n.p} color={n.c} pulse={i * 0.8} />
      ))}
      <PulseTravellers edges={edges} />
    </group>
  );
}

export function Hero3D() {
  return (
    <div className="absolute inset-0 -z-10 opacity-70 dark:opacity-60" aria-hidden>
      <Canvas camera={{ position: [0, -0.4, 7], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <pointLight position={[6, 6, 6]} intensity={1.1} />
          <pointLight position={[-6, -3, 2]} intensity={0.5} color="#a855f7" />
          <SequenceGraph3D />
        </Suspense>
      </Canvas>
    </div>
  );
}
