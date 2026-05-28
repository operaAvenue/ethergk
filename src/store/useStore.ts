import { create } from 'zustand';
import * as THREE from 'three';
import { addEdge, applyNodeChanges, applyEdgeChanges, Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';

export type NodeType = 'primitive' | 'boolean' | 'offset' | 'lattice' | 'mesh' | 'modifier' | 'transform' | 'deform' | 'repeat' | 'morph' | 'output';

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
}

export interface BooleanNodeData extends BaseNodeData {
  type: 'boolean';
  operation: 'union' | 'subtract' | 'intersect' | 'smoothUnion' | 'smoothSubtract' | 'smoothIntersect';
  smoothness: number; 
}


export interface LatticeNodeData extends BaseNodeData {
  type: 'lattice';
  pattern: 'gyroid' | 'schwarzP' | 'diamond' | 'neovius' | 'iwp' | 'frd';
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
  deformType: 'twist';
  strength: number;
}

export interface RepeatNodeData extends BaseNodeData {
  type: 'repeat';
  spacing: [number, number, number];
}

export interface MorphNodeData extends BaseNodeData {
  type: 'morph';
  amount: number;
}

export type LogicNodeData = PrimitiveNodeData | BooleanNodeData | LatticeNodeData | MeshNodeData | ModifierNodeData | TransformNodeData | DeformNodeData | RepeatNodeData | MorphNodeData | OutputNodeData;
export type AppNode = Node<LogicNodeData>;

interface AppState {
  // Graph State
  nodes: AppNode[];
  edges: Edge[];
  
  // App State
  resolution: number;
  gridSize: number;
  modifiedGeometry: THREE.BufferGeometry | null;
  needsRebuild: boolean; // Flag to tell the voxelizer to rebuild
  
  // Layout State
  layoutSplitRatio: number;
  layoutIsVertical: boolean;
  layoutIsSwapped: boolean;
  
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
  setModifiedGeometry: (geometry: THREE.BufferGeometry | null) => void;
  triggerRebuild: () => void;
  
  setLayoutSplitRatio: (ratio: number) => void;
  setLayoutIsVertical: (isVert: boolean) => void;
  setLayoutIsSwapped: (isSwap: boolean) => void;
}

const initialNodes: AppNode[] = [
  { id: 'out', type: 'outputNode', position: { x: 800, y: 300 }, data: { type: 'output', name: 'Final Render' } },
];

const initialEdges: Edge[] = [];

export const useStore = create<AppState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  
  resolution: 40,
  gridSize: 10,
  modifiedGeometry: null,
  needsRebuild: true,
  
  layoutSplitRatio: 50,
  layoutIsVertical: true,
  layoutIsSwapped: false,
  
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
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          // It's important to create a new object here to trigger React renders
          return { ...node, data: { ...node.data, ...data } as LogicNodeData };
        }
        return node;
      }),
    });
    get().triggerRebuild();
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
  
  setModifiedGeometry: (geometry) => set({ modifiedGeometry: geometry, needsRebuild: false }),
  
  triggerRebuild: () => set({ needsRebuild: true }),
  
  setLayoutSplitRatio: (ratio) => set({ layoutSplitRatio: ratio }),
  setLayoutIsVertical: (isVert) => set({ layoutIsVertical: isVert }),
  setLayoutIsSwapped: (isSwap) => set({ layoutIsSwapped: isSwap })
}));
