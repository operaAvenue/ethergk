"use client";

import { useStore } from '@/store/useStore';
import { buildGraphSDF } from '@/lib/nodeEvaluator';
import { Voxelizer } from '@/lib/voxelizer';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Upload, Download, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

// @ts-ignore
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function UIController() {
  const { addNode, resolution, setResolution, setModifiedGeometry, gridSize, needsRebuild } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evaluate Graph
  useEffect(() => {
    if (!needsRebuild) return;
    
    try {
      const sdfFunc = buildGraphSDF();
      const voxelizer = new Voxelizer(resolution, gridSize);
      voxelizer.evaluateSDF(sdfFunc);
      setModifiedGeometry(voxelizer.getGeometry());
    } catch (err) {
      console.error("Failed to voxelize graph:", err);
    }
  }, [needsRebuild, resolution, gridSize, setModifiedGeometry]);

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
          
          if (!geometry.index) {
            geometry = BufferGeometryUtils.mergeVertices(geometry);
          }
          
          // Auto scale to fit within Marching Cubes grid!
          geometry.computeBoundingBox();
          const bbox = geometry.boundingBox!;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          // We want the object to fit comfortably within `gridSize` (e.g. 10)
          // So we scale it down to span at most gridSize * 0.8
          const targetMax = gridSize * 0.8;
          const scaleFactor = targetMax / maxDim;
          
          geometry.center(); 
          geometry.scale(scaleFactor, scaleFactor, scaleFactor);
          
          geometry.computeVertexNormals();
          geometry.computeBoundsTree();
          
          const newNodeId = 'mesh_' + Date.now();
          addNode({
            id: newNodeId,
            type: 'meshNode',
            position: { x: 50, y: 300 },
            data: {
              type: 'mesh',
              name: file.name,
              geometry: geometry,
              bvh: geometry.boundsTree,
              position: [0, 0, 0],
              scale: 1.0,
            }
          });

          // Automatically connect to output node
          const outputNode = useStore.getState().nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
          if (outputNode) {
            // Remove old connections to output base
            const currentEdges = useStore.getState().edges;
            const newEdges = currentEdges.filter(e => !(e.target === outputNode.id && e.targetHandle === 'base'));
            
            useStore.setState({ 
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
        } catch (error) {
          alert("Erro ao ler o arquivo STL.");
        }
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    const geomToExport = useStore.getState().modifiedGeometry;
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
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-xl p-3 border border-zinc-800 text-zinc-100 z-10 flex items-center justify-between">
      
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-fuchsia-500" />
        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400">
          Pico Node Editor
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

        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> Import STL
          </button>
          <input 
            type="file" 
            accept=".stl" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          
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
