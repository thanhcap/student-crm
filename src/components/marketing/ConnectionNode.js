'use client';
// V10 — a person as a flat, camera-facing avatar circle (billboarded), NOT a
// 3D sphere: glowing ring frame + dark interior slot. The interior content is
// a PLACEHOLDER (initials) designed for the founder to swap in an Apple emoji,
// a macOS icon, or a real photo later — see the marked block below.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Ring, Html, Circle } from '@react-three/drei';
import * as THREE from 'three';

export default function ConnectionNode({ groupRef, position, color, label, initials, delay = 0 }) {
  const [hovered, setHovered] = useState(false);

  // Orbit the Earth: circular path in the xz plane, keeping the y (latitude)
  // offset, plus a gentle vertical bob. Farther nodes orbit slower.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + delay;
    const g = groupRef.current;
    if (!g) return;
    const r = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
    const speed = 0.08 / (r * 0.25);
    g.position.x = Math.cos(t * speed) * position[0] - Math.sin(t * speed) * position[2];
    g.position.z = Math.sin(t * speed) * position[0] + Math.cos(t * speed) * position[2];
    g.position.y = position[1] + Math.sin(t * 0.3) * 0.12;
  });

  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Billboard keeps the circle facing the camera — a UI element, not a 3D object */}
      <Billboard>
        {/* OUTER GLOW RING — the avatar frame */}
        <Ring args={[0.28, 0.34, 48]}>
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.9 : 0.55} side={THREE.DoubleSide} />
        </Ring>

        {/* INNER CIRCLE — the avatar slot that will hold an emoji/icon later */}
        <Circle args={[0.26, 48]}>
          <meshBasicMaterial color="#0A0A18" side={THREE.DoubleSide} />
        </Circle>

        {/* PLACEHOLDER CONTENT — initials.
            ↓↓↓ THIS IS WHERE YOU SWAP IN AN EMOJI OR ICON LATER ↓↓↓
            Replace {initials} with:
              an emoji:  <span style={{ fontSize: 20 }}>🧑‍💼</span>
              an icon:   <img src="/icons/person1.png" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              a photo:   <img src="/avatars/sarah.jpg" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            The circle frame + glow ring stay unchanged. */}
        <Html center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'white',
            fontFamily: 'var(--font-space-grotesk)', userSelect: 'none',
          }}>
            {initials}
          </div>
        </Html>

        {/* HOVER — expanded glow ring + name/title tooltip */}
        {hovered && (
          <>
            <Ring args={[0.36, 0.42, 48]}>
              <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
            </Ring>
            <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
              <div className="mt-12 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-white whitespace-nowrap"
                   style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {label}
              </div>
            </Html>
          </>
        )}
      </Billboard>
    </group>
  );
}
