"use client";

import { useStore } from '@/store/useStore';
import { buildGraphSDF } from '@/lib/nodeEvaluator';
import { Voxelizer } from '@/lib/voxelizer';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Upload, Download, Sparkles, ArrowLeftRight, Columns, Rows, Save, FolderOpen } from 'lucide-react';
import { useEffect, useRef } from 'react';

// @ts-ignore
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

function getMergedGeometryFromGroup(group: THREE.Object3D): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);
      geometries.push(geom);
    }
  });
  if (geometries.length === 0) {
    throw new Error("No meshes found in the imported file");
  }
  const merged = BufferGeometryUtils.mergeGeometries(geometries, true);
  geometries.forEach(g => g.dispose());
  return merged;
}

function parseFileToGeometry(extension: string, buffer: ArrayBuffer): THREE.BufferGeometry {
  if (extension === 'stl') {
    const loader = new STLLoader();
    return loader.parse(buffer);
  } else if (extension === 'obj') {
    const loader = new OBJLoader();
    const text = new TextDecoder().decode(buffer);
    const group = loader.parse(text);
    return getMergedGeometryFromGroup(group);
  } else if (extension === 'fbx') {
    const loader = new FBXLoader();
    const group = loader.parse(buffer, '');
    return getMergedGeometryFromGroup(group);
  } else {
    throw new Error(`Unsupported file extension: ${extension}`);
  }
}

export function UIController() {
  const { addNode, resolution, setResolution, setModifiedGeometry, gridSize, needsRebuild } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openProjectInputRef = useRef<HTMLInputElement>(null);

  // Evaluate Graph with Debounce
  useEffect(() => {
    if (!needsRebuild) return;
    
    const t = setTimeout(() => {
      try {
        const sdfFunc = buildGraphSDF();
        const voxelizer = new Voxelizer(resolution, gridSize);
        voxelizer.evaluateSDF(sdfFunc);
        setModifiedGeometry(voxelizer.getGeometry());
      } catch (err) {
        console.error("Failed to voxelize graph:", err);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [needsRebuild, resolution, gridSize, setModifiedGeometry]);

  const handleSaveProject = () => {
    const state = useStore.getState();
    const cleanNodes = state.nodes.map(node => {
      const dataCopy = { ...node.data } as any;
      if (dataCopy.geometry) delete dataCopy.geometry;
      if (dataCopy.bvh) delete dataCopy.bvh;
      return { ...node, data: dataCopy };
    });
    
    const project = {
      nodes: cleanNodes,
      edges: state.edges,
      resolution: state.resolution,
      gridSize: state.gridSize,
      version: 1
    };
    
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ethergk_project.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string);
        if (!project.nodes || !project.edges) throw new Error("Invalid project file");

        // Reconstruct heavy objects for mesh nodes
        const reconstructedNodes = project.nodes.map((node: any) => {
          if ((node.type === 'meshNode' || node.data.type === 'mesh') && (node.data.fileBase64 || node.data.stlBase64)) {
            const base64Data = node.data.fileBase64 || node.data.stlBase64;
            const extension = node.data.fileExtension || 'stl';

            // Decode base64 to ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            let geometry = parseFileToGeometry(extension, bytes.buffer);
            
            // Re-apply Auto scale
            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox!;
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetMax = (project.gridSize || 10) * 0.8;
            const scaleFactor = targetMax / maxDim;
            
            geometry.center(); 
            geometry.scale(scaleFactor, scaleFactor, scaleFactor);

            if (!geometry.index) {
              geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
            }
            geometry.computeVertexNormals();
            geometry.computeBoundsTree();

            geometry.computeBoundingBox();
            const finalBbox = geometry.boundingBox!;
            const padding = 2.0; 
            const bboxMin = finalBbox.min.clone().subScalar(padding);
            const bboxMax = finalBbox.max.clone().addScalar(padding);

            node.data.geometry = geometry;
            node.data.bvh = geometry.boundsTree;
            node.data.color = node.data.color || '#f97316';
            node.data.bboxMin = [bboxMin.x, bboxMin.y, bboxMin.z];
            node.data.bboxMax = [bboxMax.x, bboxMax.y, bboxMax.z];
          }
          return node;
        });

        useStore.getState().loadProject({
          ...project,
          nodes: reconstructedNodes
        });

      } catch (err) {
        console.error("Failed to load project:", err);
        alert("Failed to load project. The file might be corrupted or incompatible.");
      }
      
      if (openProjectInputRef.current) openProjectInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || 'stl';

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target?.result;
      if (contents) {
        try {
          const buffer = contents as ArrayBuffer;
          let geometry = parseFileToGeometry(extension, buffer);
          
          // Convert ArrayBuffer to Base64 for saving
          const uint8Array = new Uint8Array(buffer);
          // Fast base64 conversion for large arrays
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(uint8Array.subarray(i, i + chunkSize)));
          }
          const fileBase64 = btoa(binary);
          
          // Auto scale to fit within Marching Cubes grid BEFORE merging!
          geometry.computeBoundingBox();
          const bbox = geometry.boundingBox!;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetMax = gridSize * 0.8;
          const scaleFactor = targetMax / maxDim;
          
          geometry.center(); 
          geometry.scale(scaleFactor, scaleFactor, scaleFactor);

          // Now merge vertices with a tolerance suitable for the normalized scale
          if (!geometry.index) {
            geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
          }
          
          geometry.computeVertexNormals();
          geometry.computeBoundsTree();
          const currentNodes = useStore.getState().nodes;
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
              bvh: geometry.boundsTree,
              position: [0, 0, 0],
              scale: 1.0,
              color: '#f97316',
              fileBase64: fileBase64,
              fileExtension: extension,
              stlBase64: extension === 'stl' ? fileBase64 : undefined
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
          
          // Clear input so we can import the same file again
          event.target.value = '';
        } catch (error) {
          console.error("Error reading file:", error);
          alert("Erro ao ler o arquivo 3D.");
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
    <div className="absolute top-4 left-4 right-4 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/60 shadow-2xl rounded-2xl p-3 text-zinc-100 z-10 flex items-center justify-between">
      
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-base font-bold flex items-center">
          <span className="text-zinc-500 font-semibold tracking-tight">EtherGeometry</span>
          <span className="text-[#ffb300] font-black tracking-wide pl-0.5">Kernel</span>
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Voxel Grid: {resolution}^3
          </label>
          <input 
            type="range" 
            min="20" max="150" step="10" 
            value={resolution} 
            onChange={(e) => setResolution(parseInt(e.target.value))}
            className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        <div className="flex gap-2 items-center">
          <button 
            onClick={() => useStore.getState().setUiMode(useStore.getState().uiMode === 'nodes' ? 'sidebar' : 'nodes')}
            className={`p-2 rounded-xl border transition-all duration-200 mr-2 ${useStore.getState().uiMode === 'sidebar' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
            title="Toggle Sidebar Mode"
          >
            <Columns className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <button 
            onClick={() => useStore.getState().setLayoutIsSwapped(!useStore.getState().layoutIsSwapped)}
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all duration-200"
            title="Swap Panels"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => useStore.getState().setLayoutIsVertical(!useStore.getState().layoutIsVertical)}
            className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all duration-200 mr-2"
            title="Toggle Orientation"
          >
            {useStore.getState().layoutIsVertical ? <Rows className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
          </button>

          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <button 
            onClick={handleSaveProject}
            className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200"
          >
            <Save className="w-4 h-4" /> Save
          </button>

          <label className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer mr-2">
            <FolderOpen className="w-4 h-4" /> Open
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={openProjectInputRef}
              onChange={handleOpenProject} 
            />
          </label>

          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <label className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer">
            <Upload className="w-4 h-4 text-amber-500" /> Import 3D File
            <input 
              type="file" 
              accept=".stl,.obj,.fbx" 
              className="hidden" 
              onClick={handleInputClick}
              onChange={handleFileUpload} 
            />
          </label>
          
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 py-1.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          >
            <Download className="w-4 h-4" /> Export STL
          </button>
        </div>
      </div>
      
    </div>
  );
}
