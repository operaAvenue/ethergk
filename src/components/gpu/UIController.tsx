"use client";

import { useGpuStore } from '@/store/useGpuStore';
import { compileGraphToGLSL } from '@/lib/gpu/shaderCompiler';
import { buildGraphSDF } from '@/lib/nodeEvaluator';
import { Voxelizer } from '@/lib/voxelizer';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Upload, Download, Sparkles, ArrowLeftRight, Columns, Rows } from 'lucide-react';
import { useEffect, useRef } from 'react';

// @ts-ignore
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function UIController() {
  const { addNode, resolution, setResolution, setModifiedGeometry, gridSize, needsRebuild } = useGpuStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evaluate Graph
  useEffect(() => {
    if (!needsRebuild) return;
    
    try {
      const glsl = compileGraphToGLSL();
      useGpuStore.getState().setGlslShader(glsl);
      useGpuStore.getState().triggerRebuild(); // Actually, just set the shader and clear rebuild
      useGpuStore.setState({ needsRebuild: false });
    } catch (err) {
      console.error("Failed to compile shader:", err);
    }
  }, [needsRebuild]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target?.result;
      if (contents) {
        const loader = new STLLoader();
        try {
          let geometry = loader.parse(contents as ArrayBuffer);
          
          // Auto scale to fit within Marching Cubes grid BEFORE merging!
          // This prevents floating point inaccuracies in huge or tiny STLs from breaking mergeVertices
          geometry.computeBoundingBox();
          const bbox = geometry.boundingBox!;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetMax = gridSize * 0.8;
          const scaleFactor = targetMax / maxDim;
          
          geometry.center(); 
          geometry.scale(scaleFactor, scaleFactor, scaleFactor);

          // Now merge vertices with a tolerance suitable for the normalized scale (8.0)
          if (!geometry.index) {
            geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
          }
          
          geometry.computeVertexNormals();
          geometry.computeBoundsTree();
          
          // --- BAKE SDF 3D TEXTURE ---
          geometry.computeBoundingBox();
          const finalBbox = geometry.boundingBox!;
          // Add some padding to the bounding box so the SDF doesn't clip hard at the edges
          const padding = 2.0; 
          const bboxMin = finalBbox.min.clone().subScalar(padding);
          const bboxMax = finalBbox.max.clone().addScalar(padding);
          const bvh = geometry.boundsTree!;
          
          const texSize = 64; // 64x64x64 = 262,144 points
          const dataArray = new Float32Array(texSize * texSize * texSize);
          
          const targetInfo: any = {};
          const p = new THREE.Vector3();
          const dir = new THREE.Vector3(Math.PI, Math.E, Math.SQRT2).normalize();
          const ray = new THREE.Ray(p, dir);
          
          for (let z = 0; z < texSize; z++) {
            for (let y = 0; y < texSize; y++) {
              for (let x = 0; x < texSize; x++) {
                p.set(
                  bboxMin.x + (x / (texSize - 1)) * (bboxMax.x - bboxMin.x),
                  bboxMin.y + (y / (texSize - 1)) * (bboxMax.y - bboxMin.y),
                  bboxMin.z + (z / (texSize - 1)) * (bboxMax.z - bboxMin.z)
                );
                
                bvh.closestPointToPoint(p, targetInfo);
                let signedDist = targetInfo.distance;
                
                ray.origin.copy(p);
                const hits = bvh.raycast(ray, THREE.DoubleSide);
                if (hits && hits.length % 2 === 1) {
                  signedDist = -Math.abs(signedDist); // inside
                } else {
                  signedDist = Math.abs(signedDist); // outside
                }
                
                const index = x + y * texSize + z * texSize * texSize;
                dataArray[index] = signedDist;
              }
            }
          }
          
          const sdfTexture = new THREE.Data3DTexture(dataArray, texSize, texSize, texSize);
          sdfTexture.format = THREE.RedFormat;
          sdfTexture.type = THREE.FloatType;
          sdfTexture.internalFormat = 'R32F';
          sdfTexture.minFilter = THREE.LinearFilter;
          sdfTexture.magFilter = THREE.LinearFilter;
          sdfTexture.needsUpdate = true;
          // ---------------------------

          const currentNodes = useGpuStore.getState().nodes;
          const yOffset = 300 + (currentNodes.filter(n => n.type === 'meshNode').length * 50);
          
          const newNodeId = 'mesh_' + Date.now();
          addNode({
            id: newNodeId,
            type: 'meshNode',
            position: { x: 50, y: yOffset },
            data: {
              type: 'mesh',
              name: file.name,
              geometry: geometry,
              bvh: bvh,
              position: [0, 0, 0],
              scale: 1.0,
              sdfTexture: sdfTexture,
              bboxMin: [bboxMin.x, bboxMin.y, bboxMin.z],
              bboxMax: [bboxMax.x, bboxMax.y, bboxMax.z]
            }
          });

          // Automatically connect to output node
          const outputNode = useGpuStore.getState().nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
          if (outputNode) {
            // Remove old connections to output base
            const currentEdges = useGpuStore.getState().edges;
            const newEdges = currentEdges.filter(e => !(e.target === outputNode.id && e.targetHandle === 'base'));
            
            useGpuStore.setState({ 
              edges: [...newEdges, {
                id: `e-${newNodeId}-${outputNode.id}`,
                source: newNodeId,
                target: outputNode.id,
                sourceHandle: 'out',
                targetHandle: 'base',
                type: 'default'
              }],
              needsRebuild: true
            });
          }
          
          // Clear input so we can import the same file again
          event.target.value = '';
        } catch (error) {
          alert("Erro ao ler o arquivo STL.");
          event.target.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    // Reset input value so the same file can be selected again
    event.currentTarget.value = '';
  };

  const handleDownload = () => {
    try {
      const sdfFunc = buildGraphSDF();
      const voxelizer = new Voxelizer(resolution, gridSize);
      voxelizer.evaluateSDF(sdfFunc);
      const geomToExport = voxelizer.getGeometry();
      
      if (!geomToExport) return;

      const exporter = new STLExporter();
      const mesh = new THREE.Mesh(geomToExport, new THREE.MeshBasicMaterial());
      
      const stlString = exporter.parse(mesh, { binary: false });
      const blob = new Blob([stlString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = 'picogk_export.stl';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to voxelize graph for export:", err);
      alert("Failed to export STL. See console for details.");
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-xl p-3 border border-zinc-800 text-zinc-100 z-10 flex items-center justify-between">
      
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-fuchsia-500" />
        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">
          Ether Geometry Kernel
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Voxel Grid: {resolution}^3
          </label>
          <input 
            type="range" 
            min="20" max="150" step="10" 
            value={resolution} 
            onChange={(e) => setResolution(parseInt(e.target.value))}
            className="w-32 accent-fuchsia-500"
          />
        </div>

        <div className="flex gap-2 items-center">
          <button 
            onClick={() => useGpuStore.getState().setLayoutIsSwapped(!useGpuStore.getState().layoutIsSwapped)}
            className="p-2 rounded hover:bg-zinc-800 transition-colors"
            title="Swap Panels"
          >
            <ArrowLeftRight className="w-5 h-5 text-zinc-400" />
          </button>
          <button 
            onClick={() => useGpuStore.getState().setLayoutIsVertical(!useGpuStore.getState().layoutIsVertical)}
            className="p-2 rounded hover:bg-zinc-800 transition-colors mr-2"
            title="Toggle Orientation"
          >
            {useGpuStore.getState().layoutIsVertical ? <Rows className="w-5 h-5 text-zinc-400" /> : <Columns className="w-5 h-5 text-zinc-400" />}
          </button>

          <label className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Import STL
            <input 
              type="file" 
              accept=".stl" 
              className="hidden" 
              onClick={handleInputClick}
              onChange={handleFileUpload} 
            />
          </label>
          
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Export STL
          </button>
        </div>
      </div>
      
    </div>
  );
}
