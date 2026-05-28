"use client";

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGpuStore } from '@/store/useGpuStore';
import * as THREE from 'three';
import { useRef, useMemo, useEffect } from 'react';

const vertexShader = `
varying vec3 vPosition;
varying vec2 vUv;
void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

function RaymarchQuad() {
  const glslShader = useGpuStore((state) => state.glslShader);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera, size } = useThree();

  const uniforms = useMemo(() => ({
    cameraPos: { value: new THREE.Vector3() },
    cameraDir: { value: new THREE.Vector3() },
    cameraUp: { value: new THREE.Vector3() },
    cameraRight: { value: new THREE.Vector3() },
    resolution: { value: new THREE.Vector2(size.width, size.height) }
  }), []);

  useEffect(() => {
    uniforms.resolution.value.set(size.width, size.height);
  }, [size]);

  useFrame(() => {
    if (!materialRef.current) return;
    
    // Update camera uniforms based on OrbitControls
    const cam = camera as THREE.PerspectiveCamera;
    uniforms.cameraPos.value.copy(cam.position);
    
    cam.getWorldDirection(uniforms.cameraDir.value);
    
    uniforms.cameraUp.value.copy(cam.up).transformDirection(cam.matrixWorld);
    uniforms.cameraRight.value.crossVectors(uniforms.cameraDir.value, uniforms.cameraUp.value).normalize();
  });

  if (!glslShader || glslShader === '') return null;

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial 
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={glslShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export function GpuSceneViewer() {
  const nodes = useGpuStore((state) => state.nodes);
  const meshNodes = nodes.filter(n => n.type === 'mesh' || n.data.type === 'mesh');

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <RaymarchQuad />
        
        {meshNodes.map((node) => {
          const data = node.data as any;
          if (!data.geometry) return null;
          return (
            <mesh 
              key={node.id} 
              geometry={data.geometry} 
              position={data.position ? new THREE.Vector3(...data.position) : new THREE.Vector3()}
              scale={data.scale || 1}
            >
              <meshStandardMaterial 
                color={data.color || '#f97316'} 
                roughness={0.4} 
                metalness={0.1}
                transparent={true}
                opacity={0.8}
              />
            </mesh>
          );
        })}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
