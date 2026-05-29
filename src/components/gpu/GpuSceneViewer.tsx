"use client";

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGpuStore } from '@/store/useGpuStore';
import { ViewportControls } from '@/components/ViewportControls';
import * as THREE from 'three';
import { useRef, useMemo, useEffect } from 'react';

const vertexShader = `
out vec3 vPosition;
out vec2 vUv;
void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

interface RaymarchUniforms {
  cameraPos: { value: THREE.Vector3 };
  cameraDir: { value: THREE.Vector3 };
  cameraUp: { value: THREE.Vector3 };
  cameraRight: { value: THREE.Vector3 };
  resolution: { value: THREE.Vector2 };
  uShowGround: { value: number };
  uShowShadows: { value: number };
  uShowAO: { value: number };
  uLightDir: { value: THREE.Vector3 };
  uLightIntensity: { value: number };
  uAmbientIntensity: { value: number };
  uFocalLength: { value: number };
  [key: string]: { value: THREE.Vector3 | THREE.Vector2 | THREE.Data3DTexture | number };
}

function RaymarchQuad() {
  const glslShader = useGpuStore((state) => state.glslShader);
  const nodes = useGpuStore((state) => state.nodes);
  
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera, size } = useThree();

  // Create dynamic uniforms object on every render
  const uniforms = useMemo<RaymarchUniforms>(() => {
    const baseUniforms: RaymarchUniforms = {
      cameraPos: { value: new THREE.Vector3() },
      cameraDir: { value: new THREE.Vector3() },
      cameraUp: { value: new THREE.Vector3() },
      cameraRight: { value: new THREE.Vector3() },
      resolution: { value: new THREE.Vector2(size.width, size.height) },
      uShowGround: { value: 1.0 },
      uShowShadows: { value: 1.0 },
      uShowAO: { value: 1.0 },
      uLightDir: { value: new THREE.Vector3(10, 10, 5) },
      uLightIntensity: { value: 1.0 },
      uAmbientIntensity: { value: 0.3 },
      uFocalLength: { value: 1.0 }
    };
    
    // Add all active mesh textures to uniforms immediately!
    nodes.forEach(node => {
      if (node.data.type === 'mesh') {
        const data = node.data;
        if (data.sdfTexture) {
          const texName = `u_meshTex_${node.id.replace(/-/g, '_')}`;
          baseUniforms[texName] = { value: data.sdfTexture };
        }
      }
    });
    
    return baseUniforms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, size.width, size.height]);

  // Sync resolution when size changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.resolution.value.set(size.width, size.height);
    }
  }, [size.width, size.height]);

  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) return;
    
    // Update camera uniforms based on OrbitControls
    const cam = camera as THREE.PerspectiveCamera;
    mat.uniforms.cameraPos.value.copy(cam.position);
    
    cam.getWorldDirection(mat.uniforms.cameraDir.value);
    mat.uniforms.cameraUp.value.set(0, 1, 0).applyQuaternion(cam.quaternion);
    mat.uniforms.cameraRight.value.set(1, 0, 0).applyQuaternion(cam.quaternion);

    const focalLength = 1.0 / Math.tan((cam.fov * Math.PI) / 180 / 2.0);
    mat.uniforms.uFocalLength.value = focalLength;

    // Update visualization uniforms directly from the store to prevent stale closures
    const storeState = useGpuStore.getState();
    mat.uniforms.uShowGround.value = storeState.showGround ? 1.0 : 0.0;
    mat.uniforms.uShowShadows.value = storeState.showShadows ? 1.0 : 0.0;
    mat.uniforms.uShowAO.value = storeState.showAO ? 1.0 : 0.0;
    mat.uniforms.uLightDir.value.set(...storeState.lightDir);
    mat.uniforms.uLightIntensity.value = storeState.lightIntensity;
    mat.uniforms.uAmbientIntensity.value = storeState.ambientIntensity;
  });

  if (!glslShader || glslShader === '') return null;

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial 
        key={glslShader} // Force R3F/Three.js to recreate material with new shader compiler outputs and uniform layout
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
  const showWireframe = useGpuStore((state) => state.showWireframe);
  const modifiedGeometry = useGpuStore((state) => state.modifiedGeometry);
  const gridSize = useGpuStore((state) => state.gridSize);

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        {/* Dark mode background */}
        <color attach="background" args={['#09090b']} />
        
        <RaymarchQuad />

        {showWireframe && modifiedGeometry && (
          <mesh geometry={modifiedGeometry} scale={[gridSize * 0.5, gridSize * 0.5, gridSize * 0.5]}>
            <meshBasicMaterial 
              color="#d946ef"
              wireframe
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        )}
        
        <OrbitControls makeDefault />
      </Canvas>
      <ViewportControls type="gpu" />
    </div>
  );
}
