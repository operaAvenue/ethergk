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
  const nodes = useGpuStore((state) => state.nodes);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera, size } = useThree();

  const uniforms = useMemo(() => {
    const baseUniforms: any = {
      cameraPos: { value: new THREE.Vector3() },
      cameraDir: { value: new THREE.Vector3() },
      cameraUp: { value: new THREE.Vector3() },
      cameraRight: { value: new THREE.Vector3() },
      resolution: { value: new THREE.Vector2(size.width, size.height) }
    };
    return baseUniforms;
  }, []);

  useEffect(() => {
    uniforms.resolution.value.set(size.width, size.height);
  }, [size, uniforms]);

  useEffect(() => {
    // Dynamically add mesh textures to uniforms when they change
    nodes.forEach(node => {
      const data = node.data as any;
      if ((node.type === 'meshNode' || data.type === 'mesh') && data.sdfTexture) {
        const texName = `u_meshTex_${node.id.replace(/-/g, '_')}`;
        if (!uniforms[texName]) {
          uniforms[texName] = { value: data.sdfTexture };
        } else {
          uniforms[texName].value = data.sdfTexture;
        }
      }
    });
  }, [nodes, uniforms]);

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
        glslVersion={THREE.GLSL3}
      />
    </mesh>
  );
}

export function GpuSceneViewer() {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <RaymarchQuad />
        
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
