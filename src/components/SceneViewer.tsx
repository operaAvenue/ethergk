"use client";

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import { ViewportControls } from '@/components/ViewportControls';
import * as THREE from 'three';

export function SceneViewer() {
  const modifiedGeometry = useStore((state) => state.modifiedGeometry);
  const gridSize = useStore((state) => state.gridSize);
  
  // Connect visualization settings from the store
  const showGround = useStore((state) => state.showGround);
  const showShadows = useStore((state) => state.showShadows);
  const showAO = useStore((state) => state.showAO);
  const showWireframe = useStore((state) => state.showWireframe);
  const lightDir = useStore((state) => state.lightDir);
  const lightIntensity = useStore((state) => state.lightIntensity);
  const ambientIntensity = useStore((state) => state.ambientIntensity);

  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 50 }}>
        {/* Dark mode background */}
        <color attach="background" args={['#09090b']} />
        
        {/* Light Settings */}
        <ambientLight intensity={ambientIntensity} />
        <directionalLight 
          position={lightDir} 
          intensity={lightIntensity} 
          castShadow={showShadows} 
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        
        <Environment preset="city" />

        {/* Solid Shaded Mesh */}
        {modifiedGeometry && (
          <mesh geometry={modifiedGeometry} castShadow receiveShadow scale={[gridSize * 0.5, gridSize * 0.5, gridSize * 0.5]}>
            <meshStandardMaterial 
              vertexColors={true}
              roughness={0.2} 
              metalness={0.2} 
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Wireframe Overlay Mesh */}
        {showWireframe && modifiedGeometry && (
          <mesh geometry={modifiedGeometry} scale={[gridSize * 0.5, gridSize * 0.5, gridSize * 0.5]}>
            <meshBasicMaterial 
              color="#d946ef"
              wireframe
              transparent
              opacity={0.45}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        )}

        {/* Ground Plane and Grid Helper */}
        {showGround && (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
              <planeGeometry args={[100, 100]} />
              <MeshReflectorMaterial
                blur={[300, 100]}
                resolution={1024}
                mixBlur={1}
                mixStrength={2.0}
                roughness={0.15}
                depthScale={1.2}
                minDepthThreshold={0.4}
                maxDepthThreshold={1.4}
                color="#0f0f11"
                metalness={0.8}
              />
            </mesh>
            {showShadows && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.995, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <shadowMaterial opacity={0.6} />
              </mesh>
            )}
            <gridHelper args={[100, 100, '#1f1f23', '#18181b']} position={[0, -3.99, 0]} />
          </>
        )}

        {/* Ambient Occlusion Approximation (Contact Shadows) */}
        <ContactShadows 
          position={[0, -3.99, 0]} 
          opacity={showAO ? 0.6 : 0.0} 
          scale={40} 
          blur={2.5} 
          far={10} 
          color="#000000" 
        />
        
        <OrbitControls makeDefault />
      </Canvas>
      <ViewportControls type="cpu" />
    </div>
  );
}
