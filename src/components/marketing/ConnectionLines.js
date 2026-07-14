'use client';
// V10 — curved connection arcs between avatar circles (flight-path style, arcing
// outward from the Earth) + pulse dots traveling along them ("data flowing").
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function arcCurve(a, b) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.add(mid.clone().normalize().multiplyScalar(Math.max(a.length(), b.length()) * 0.3));
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

export function ConnectionArc({ nodeRefA, nodeRefB, color = '#8B5CF6' }) {
  const lineRef = useRef();
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
    [color]
  );

  useFrame(() => {
    if (!nodeRefA.current || !nodeRefB.current || !lineRef.current) return;
    const curve = arcCurve(nodeRefA.current.position.clone(), nodeRefB.current.position.clone());
    lineRef.current.geometry.dispose();
    lineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
  });

  return <line ref={lineRef}><bufferGeometry /><primitive object={material} attach="material" /></line>;
}

export function PulseDot({ nodeRefA, nodeRefB, color = '#ffffff', speed = 0.2 }) {
  const dotRef = useRef();

  useFrame(({ clock }) => {
    if (!nodeRefA.current || !nodeRefB.current || !dotRef.current) return;
    const progress = (clock.getElapsedTime() * speed) % 1;
    const curve = arcCurve(nodeRefA.current.position.clone(), nodeRefB.current.position.clone());
    dotRef.current.position.copy(curve.getPoint(progress));
    dotRef.current.material.opacity = Math.sin(progress * Math.PI) * 0.8; // fade at ends
  });

  return (
    <mesh ref={dotRef}>
      <sphereGeometry args={[0.04, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0} />
    </mesh>
  );
}
