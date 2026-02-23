"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";

function SoccerBall() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create a soccer ball pattern using a custom shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color("#10B981") },
        uColor2: { value: new THREE.Color("#0A0E1A") },
        uGlow: { value: new THREE.Color("#10B981") },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uGlow;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Simplex-like hash
        float hash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        // Voronoi for pentagon pattern
        float voronoi(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          float minDist = 1.0;
          for(int x = -1; x <= 1; x++) {
            for(int y = -1; y <= 1; y++) {
              for(int z = -1; z <= 1; z++) {
                vec3 neighbor = vec3(float(x), float(y), float(z));
                vec3 point = vec3(hash(i + neighbor));
                vec3 diff = neighbor + point - f;
                float dist = length(diff);
                minDist = min(minDist, dist);
              }
            }
          }
          return minDist;
        }

        void main() {
          // Soccer ball pattern using voronoi on sphere surface
          vec3 dir = normalize(vPosition) * 3.0;
          float v = voronoi(dir);

          // Create panel edges
          float edge = smoothstep(0.08, 0.12, v);

          // Alternate black and white panels
          float panel = step(0.5, hash(floor(dir)));

          vec3 darkColor = uColor2;
          vec3 lightColor = vec3(0.95);
          vec3 panelColor = mix(darkColor, lightColor, panel);

          // Edge glow
          float edgeGlow = 1.0 - smoothstep(0.05, 0.15, v);
          vec3 glowColor = uColor1 * (0.5 + 0.5 * sin(uTime * 2.0));

          // Fresnel effect for rim glow
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

          vec3 finalColor = mix(panelColor, vec3(1.0), edgeGlow * 0.3);
          finalColor += glowColor * edgeGlow * 0.6;
          finalColor += uGlow * fresnel * (0.4 + 0.2 * sin(uTime * 1.5));

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} material={material}>
        <icosahedronGeometry args={[1.2, 12]} />
      </mesh>
    </Float>
  );
}

function OrbitalRing({ radius, speed, color, thickness = 0.008 }: { radius: number; speed: number; color: string; thickness?: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.elapsedTime * speed;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2 + Math.random() * 0.5, Math.random() * 0.5, 0]}>
      <torusGeometry args={[radius, thickness, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}

function Particles({ count = 60, color = "#10B981", opacity = 0.6, size = 0.04, baseRadius = 2, spread = 2, rotSpeed = 0.05 }: {
  count?: number; color?: string; opacity?: number; size?: number; baseRadius?: number; spread?: number; rotSpeed?: number;
}) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = baseRadius + Math.random() * spread;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [count, baseRadius, spread]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * rotSpeed;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function Lights() {
  const light1 = useRef<THREE.PointLight>(null);
  const light2 = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (light1.current) {
      light1.current.position.x = Math.sin(t * 0.7) * 3;
      light1.current.position.z = Math.cos(t * 0.7) * 3;
    }
    if (light2.current) {
      light2.current.position.x = Math.cos(t * 0.5) * 3;
      light2.current.position.z = Math.sin(t * 0.5) * 3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight ref={light1} color="#10B981" intensity={2} distance={8} position={[3, 2, 0]} />
      <pointLight ref={light2} color="#3B82F6" intensity={1.5} distance={8} position={[-3, -1, 2]} />
      <pointLight color="#F59E0B" intensity={0.8} distance={6} position={[0, 3, -2]} />
    </>
  );
}

export default function FootballScene({ height = "280px" }: { height?: string }) {
  return (
    <div style={{ height, width: "100%" }} className="relative">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Lights />
        <SoccerBall />
        <OrbitalRing radius={1.8} speed={0.4} color="#10B981" thickness={0.006} />
        <OrbitalRing radius={2.1} speed={-0.3} color="#3B82F6" thickness={0.005} />
        <OrbitalRing radius={2.4} speed={0.2} color="#F59E0B" thickness={0.004} />
        <Particles count={80} color="#10B981" opacity={0.6} size={0.04} baseRadius={2} spread={2} rotSpeed={0.05} />
        <Particles count={50} color="#3B82F6" opacity={0.4} size={0.025} baseRadius={1.5} spread={3} rotSpeed={-0.03} />
      </Canvas>
      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
    </div>
  );
}
