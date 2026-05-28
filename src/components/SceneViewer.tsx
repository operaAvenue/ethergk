"use client";

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import * as THREE from 'three';

export function SceneViewer() {
  const modifiedGeometry = useStore((state) => state.modifiedGeometry);
  const nodes = useStore((state) => state.nodes);

  // We can choose to render wireframes for the primitives to guide the user
  const primitiveNodes = nodes.filter(n => n.type === 'primitiveNode' || n.type === 'booleanNode');

  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 50 }}>
        {/* Dark mode background */}
        <color attach="background" args={['#09090b']} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Environment preset="city" />


          {modifiedGeometry && (
            <mesh geometry={modifiedGeometry} castShadow receiveShadow>
              <meshStandardMaterial 
                vertexColors={true}
                roughness={0.2} 
                metalness={0.2} 
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

        <ContactShadows position={[0, -5, 0]} opacity={0.4} scale={40} blur={2} far={10} color="#000000" />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
