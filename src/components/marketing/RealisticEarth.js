'use client';
// V10 — photorealistic Google Earth-style globe: NASA Blue Marble surface,
// terrain bump relief, independent cloud layer, city lights on the night side,
// ocean specular, and TWO shader atmosphere layers (tight bright limb haze +
// wide faint outer glow). Textures live in /public/textures (committed — no
// runtime external deps).
import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export default function RealisticEarth({ radius = 2.5 }) {
  const earthRef = useRef();
  const cloudsRef = useRef();

  const [dayMap, bumpMap, cloudsMap, nightMap, specMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth-day.jpg',      // photographic satellite surface (4096x2048)
    '/textures/earth-bump.jpg',     // terrain elevation
    '/textures/earth-clouds.png',   // real cloud layer (fair weather, 4k)
    '/textures/earth-night.jpg',    // city lights
    '/textures/earth-specular.jpg', // water mask -> ocean shininess
  ]);

  // Max anisotropy keeps the surface sharp where it curves away from camera.
  [dayMap, bumpMap, cloudsMap, nightMap, specMap].forEach(tex => {
    if (tex) {
      tex.anisotropy = 16;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  });
  bumpMap.colorSpace = THREE.NoColorSpace;
  specMap.colorSpace = THREE.NoColorSpace;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (earthRef.current) earthRef.current.rotation.y = t * 0.03;      // idle spin
    if (cloudsRef.current) cloudsRef.current.rotation.y = t * 0.035;   // clouds drift a bit faster
  });

  return (
    <group>
      {/* THE EARTH — 128 segments so the limb is a perfectly smooth curve */}
      <Sphere ref={earthRef} args={[radius, 128, 128]}>
        <meshPhongMaterial
          map={dayMap}
          bumpMap={bumpMap}
          bumpScale={0.06}
          emissiveMap={nightMap}
          emissive={new THREE.Color(0xffcc88)}
          emissiveIntensity={1.2}
          specularMap={specMap}
          specular={new THREE.Color(0x444444)}
          shininess={20}
        />
      </Sphere>

      {/* CLOUDS — slightly larger, semi-transparent, independent rotation */}
      <Sphere ref={cloudsRef} args={[radius * 1.006, 96, 96]}>
        <meshPhongMaterial map={cloudsMap} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </Sphere>

      {/* ATMOSPHERE — tight pale-blue limb haze */}
      <Sphere args={[radius * 1.08, 64, 64]}>
        <shaderMaterial
          transparent depthWrite={false} side={THREE.BackSide}
          uniforms={{ glowColor: { value: new THREE.Color(0x93c5fd) } }}
          vertexShader={`
            varying float intensity;
            void main() {
              vec3 vNormal = normalize(normalMatrix * normal);
              vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
              intensity = pow(0.7 - dot(vNormal, viewDir), 4.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 glowColor;
            varying float intensity;
            void main() { gl_FragColor = vec4(glowColor, intensity * 0.55); }
          `}
        />
      </Sphere>

      {/* SECONDARY ATMOSPHERE — wider, fainter outer glow for depth */}
      <Sphere args={[radius * 1.18, 48, 48]}>
        <shaderMaterial
          transparent depthWrite={false} side={THREE.BackSide}
          uniforms={{ glowColor: { value: new THREE.Color(0x60a5fa) } }}
          vertexShader={`
            varying float intensity;
            void main() {
              vec3 vNormal = normalize(normalMatrix * normal);
              vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
              intensity = pow(0.5 - dot(vNormal, viewDir), 5.0);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 glowColor;
            varying float intensity;
            void main() { gl_FragColor = vec4(glowColor, intensity * 0.2); }
          `}
        />
      </Sphere>
    </group>
  );
}
