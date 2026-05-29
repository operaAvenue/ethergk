import { create } from 'zustand';
import * as THREE from 'three';
import { addEdge, applyNodeChanges, applyEdgeChanges, Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';

export type NodeType = 'primitive' | 'boolean' | 'offset' | 'lattice' | 'mesh' | 'modifier' | 'transform' | 'deform' | 'repeat' | 'morph' | 'symmetry' | 'output';

export interface BaseNodeData extends Record<string, unknown> {
  type: NodeType;
  name: string;
}

export interface PrimitiveNodeData extends BaseNodeData {
  type: 'primitive';
  shape: 'box' | 'sphere' | 'cylinder';
  scale: number;
  position: [number, number, number];
  color?: string;
}

export interface MeshNodeData extends BaseNodeData {
  type: 'mesh';
  name: string;
  geometry: THREE.BufferGeometry | null;
  bvh: any | null; // MeshBVH
  position: [number, number, number];
  scale: number;
  color?: string;
  // Texture baking for GPU Raymarching
  sdfTexture?: THREE.Data3DTexture;
  bboxMin?: [number, number, number];
  bboxMax?: [number, number, number];
  stlBase64?: string; // Embedded STL data for saving/loading
  fileBase64?: string; // Embedded generic file data for saving/loading
  fileExtension?: string; // 'stl' | 'obj' | 'fbx'
}

export interface BooleanNodeData extends BaseNodeData {
  type: 'boolean';
  operation: 'union' | 'subtract' | 'intersect' | 'smoothUnion' | 'smoothSubtract' | 'smoothIntersect';
  smoothness: number; 
}


export interface LatticeNodeData extends BaseNodeData {
  type: 'lattice';
  pattern: 
    | 'gyroid' | 'schwarzP' | 'diamond' | 'neovius' | 'iwp' | 'frd' | 'lidinoid' | 'schwarzH' 
    | 'grid' | 'honeycomb' | 'octet' | 'sineWave' | 'foam' | 'fractalNoise' | 'cylindricalGrid' | 'tubularGyroid'
    | 'fischerKochS' | 'fischerKochD' | 'splitP' | 'gPrime' | 'iwp2' | 'carlyle' | 'crossedDecagons' 
    | 'kelvin' | 'kagome' | 'waffle' | 'chiral' | 'radialGrid' | 'herringbone' | 'weairePhelan' 
    | 'boxFrame' | 'octahedral';
  scale: number;
  thickness: number;
  color?: string;
}

export interface OutputNodeData extends BaseNodeData {
  type: 'output';
}

export interface ModifierNodeData extends BaseNodeData {
  type: 'modifier';
  modifierType: 'shell' | 'offset';
  amount: number;
}

export interface TransformNodeData extends BaseNodeData {
  type: 'transform';
  translate: [number, number, number];
  rotate: [number, number, number];
  scale: [number, number, number];
}

export interface DeformNodeData extends BaseNodeData {
  type: 'deform';
  deformType: 'twist' | 'taper' | 'bend' | 'quantize' | 'ripple' | 'elongateX' | 'elongateY' | 'bulge' | 'pinch';
  strength: number;
}

export interface SymmetryNodeData extends BaseNodeData {
  type: 'symmetry';
  symType: 'symX' | 'symY' | 'symZ' | 'radial';
  slices: number;
}

export interface RepeatNodeData extends BaseNodeData {
  type: 'repeat';
  spacing: [number, number, number];
}

export interface MorphNodeData extends BaseNodeData {
  type: 'morph';
  amount: number;
}

export type LogicNodeData = PrimitiveNodeData | BooleanNodeData | LatticeNodeData | MeshNodeData | ModifierNodeData | TransformNodeData | DeformNodeData | RepeatNodeData | MorphNodeData | OutputNodeData | SymmetryNodeData;
export type AppNode = Node<LogicNodeData>;

interface AppState {
  // Graph State
  nodes: AppNode[];
  edges: Edge[];
  
  // App State
  resolution: number;
  gridSize: number;
  modifiedGeometry: THREE.BufferGeometry | null;
  glslShader: string;
  needsRebuild: boolean; // Flag to tell the voxelizer to rebuild
  
  // Layout State
  layoutSplitRatio: number;
  layoutIsVertical: boolean;
  layoutIsSwapped: boolean;
  
  // Visualization Settings
  showGround: boolean;
  showShadows: boolean;
  showAO: boolean;
  showWireframe: boolean;
  lightDir: [number, number, number];
  lightIntensity: number;
  ambientIntensity: number;
  setVisualizationSettings: (settings: Partial<{
    showGround: boolean;
    showShadows: boolean;
    showAO: boolean;
    showWireframe: boolean;
    lightDir: [number, number, number];
    lightIntensity: number;
    ambientIntensity: number;
  }>) => void;

  // React Flow Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Custom Actions
  addNode: (node: AppNode) => void;
  updateNodeData: (id: string, data: Partial<LogicNodeData>) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  
  setResolution: (res: number) => void;
  setGlslShader: (code: string) => void;
  setModifiedGeometry: (geometry: THREE.BufferGeometry | null) => void;
  triggerRebuild: () => void;
  
  setLayoutSplitRatio: (ratio: number) => void;
  setLayoutIsVertical: (isVert: boolean) => void;
  setLayoutIsSwapped: (isSwap: boolean) => void;
  
  uiMode: 'nodes' | 'sidebar';
  setUiMode: (mode: 'nodes' | 'sidebar') => void;
  
  loadProject: (projectData: any) => void;
}

const initialNodes: AppNode[] = [
  { id: 'out', type: 'outputNode', position: { x: 800, y: 300 }, data: { type: 'output', name: 'Final Render' } },
];

const initialEdges: Edge[] = [];

export const useGpuStore = create<AppState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  
  resolution: 40,
  gridSize: 10,
  modifiedGeometry: null,
  glslShader: '',
  needsRebuild: true,
  
  layoutSplitRatio: 50,
  layoutIsVertical: true,
  layoutIsSwapped: false,
  
  showGround: true,
  showShadows: true,
  showAO: true,
  showWireframe: false,
  lightDir: [10, 10, 5],
  lightIntensity: 1.0,
  ambientIntensity: 0.3,
  setVisualizationSettings: (settings) => set((state) => ({ ...state, ...settings })),

  uiMode: 'nodes',
  setUiMode: (mode) => set({ uiMode: mode }),
  
  onNodesChange: (changes) => set({
    nodes: applyNodeChanges(changes, get().nodes) as AppNode[],
  }),
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    get().triggerRebuild();
  },
  
  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
    get().triggerRebuild();
  },
  
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  
  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map(node => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...data } as any };
        }
        return node;
      })
    });
    get().triggerRebuild();
  },
  
  loadProject: (projectData) => {
    set({
      nodes: projectData.nodes || [],
      edges: projectData.edges || [],
      resolution: projectData.resolution || 40,
      gridSize: projectData.gridSize || 10,
      needsRebuild: true
    });
  },
  
  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id)
    });
    get().triggerRebuild();
  },
  
  removeEdge: (id) => {
    set({
      edges: get().edges.filter((e) => e.id !== id)
    });
    get().triggerRebuild();
  },
  
  setResolution: (res) => {
    set({ resolution: res });
    get().triggerRebuild();
  },
  
  setGlslShader: (code) => set({ glslShader: code }),
  
  setModifiedGeometry: (geometry) => set({ modifiedGeometry: geometry, needsRebuild: false }),
  
  triggerRebuild: () => set({ needsRebuild: true }),
  
  setLayoutSplitRatio: (ratio) => set({ layoutSplitRatio: ratio }),
  setLayoutIsVertical: (isVert) => set({ layoutIsVertical: isVert }),
  setLayoutIsSwapped: (isSwap) => set({ layoutIsSwapped: isSwap })
}));
