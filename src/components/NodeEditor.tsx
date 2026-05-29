"use client";

import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore, AppNode } from '@/store/useStore';
import { OutputNode, PrimitiveNode, BooleanNode, LatticeNode, MeshNode, ModifierNode, TransformNode, DeformNode, RepeatNode, MorphNode, SymmetryNode } from './EditorNodes';
import { useState, useCallback } from 'react';

// @ts-ignore
const nodeTypes = {
  outputNode: OutputNode,
  primitiveNode: PrimitiveNode,
  booleanNode: BooleanNode,
  latticeNode: LatticeNode,
  meshNode: MeshNode,
  modifierNode: ModifierNode,
  transformNode: TransformNode,
  deformNode: DeformNode,
  symmetryNode: SymmetryNode,
  repeatNode: RepeatNode,
  morphNode: MorphNode,
};

export function NodeEditor() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, removeNode, removeEdge } = useStore();
  const [menu, setMenu] = useState<{ id: string, top: number, left: number, type: 'node' | 'edge' } | null>(null);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: AppNode) => {
      event.preventDefault();
      setMenu({ id: node.id, top: event.clientY, left: event.clientX, type: 'node' });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      setMenu({ id: edge.id, top: event.clientY, left: event.clientX, type: 'edge' });
    },
    []
  );

  const onPaneClick = useCallback(() => setMenu(null), []);

  const handleAddNode = (type: string) => {
    let newNode: AppNode;
    const id = type + '_' + Date.now();
    const position = { x: 100, y: 100 }; // simple spawn position

    switch (type) {
      case 'primitive':
        newNode = { id, type: 'primitiveNode', position, data: { type: 'primitive', name: 'Primitive', shape: 'box', position: [0, 0, 0], scale: 2, color: '#6366f1' } };
        break;
      case 'boolean':
        newNode = { id, type: 'booleanNode', position, data: { type: 'boolean', name: 'Boolean', operation: 'union', smoothness: 1.0 } };
        break;
      case 'lattice':
        newNode = { id, type: 'latticeNode', position, data: { type: 'lattice', name: 'Lattice', pattern: 'gyroid', scale: 500, thickness: 0.1, color: '#06b6d4' } };
        break;
      default: return;
    }
    
    addNode(newNode);
  };

  const btnStyle = "bg-zinc-900/90 border border-zinc-800/80 text-zinc-300 hover:text-amber-500 hover:border-amber-500/50 hover:bg-zinc-850/90 py-1.5 px-3.5 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 cursor-pointer nodrag";

  return (
    <div className="w-full h-full relative bg-zinc-950">
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 max-w-[85%]">
        <button onClick={() => handleAddNode('primitive')} className={btnStyle}>
          + Primitive
        </button>
        <button onClick={() => handleAddNode('boolean')} className={btnStyle}>
          + Boolean
        </button>
        <button onClick={() => handleAddNode('lattice')} className={btnStyle}>
          + Lattice
        </button>
        <button 
          onClick={() => addNode({ id: 'mod_' + Date.now(), type: 'modifierNode', position: { x: 200, y: 200 }, data: { type: 'modifier', name: 'Modifier', modifierType: 'shell', amount: 0.1 } })}
          className={btnStyle}
        >
          + Modifier
        </button>

        <div className="w-px h-6 bg-zinc-850 mx-1 self-center" />

        <button 
          onClick={() => addNode({ id: 'tfm_' + Date.now(), type: 'transformNode', position: { x: 200, y: 250 }, data: { type: 'transform', name: 'Transform', translate: [0,0,0], rotate: [0,0,0], scale: [1,1,1] } })}
          className={btnStyle}
        >
          + Transform
        </button>
        <button 
          onClick={() => addNode({ id: 'def_' + Date.now(), type: 'deformNode', position: { x: 200, y: 300 }, data: { type: 'deform', name: 'Deform', deformType: 'twist', strength: 0.5 } })}
          className={btnStyle}
        >
          + Deform
        </button>
        <button 
          onClick={() => addNode({ id: 'sym_' + Date.now(), type: 'symmetryNode', position: { x: 200, y: 350 }, data: { type: 'symmetry', name: 'Symmetry', symType: 'symX', slices: 6 } })}
          className={btnStyle}
        >
          + Symmetry
        </button>
        <button 
          onClick={() => addNode({ id: 'rep_' + Date.now(), type: 'repeatNode', position: { x: 200, y: 350 }, data: { type: 'repeat', name: 'Repeat', spacing: [5,0,0] } })}
          className={btnStyle}
        >
          + Array
        </button>
        <button 
          onClick={() => addNode({ id: 'mph_' + Date.now(), type: 'morphNode', position: { x: 200, y: 400 }, data: { type: 'morph', name: 'Morph', amount: 0.5 } })}
          className={btnStyle}
        >
          + Morph
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes as any}
        fitView
      >
        <Background color="#1f1f23" gap={16} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-400 !text-zinc-400" />
      </ReactFlow>

      {menu && (
        <div 
          className="fixed z-[9999] bg-zinc-950 border border-zinc-800 shadow-2xl rounded-xl p-1.5 min-w-[140px]"
          style={{ top: menu.top, left: menu.left }}
        >
          {menu.type === 'node' && (
            <button 
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-amber-500 hover:bg-zinc-900 rounded-lg font-medium transition-colors"
              onClick={() => {
                const nodeToCopy = useStore.getState().nodes.find(n => n.id === menu.id);
                if (nodeToCopy && nodeToCopy.type !== 'outputNode') {
                  const newNode = {
                    ...nodeToCopy,
                    id: nodeToCopy.type + '_' + Date.now(),
                    position: { x: nodeToCopy.position.x + 30, y: nodeToCopy.position.y + 30 },
                    data: { ...nodeToCopy.data }
                  } as any;
                  
                  if (newNode.data.translate) newNode.data.translate = [...newNode.data.translate];
                  if (newNode.data.rotate) newNode.data.rotate = [...newNode.data.rotate];
                  if (newNode.data.scale && Array.isArray(newNode.data.scale)) newNode.data.scale = [...newNode.data.scale];
                  if (newNode.data.spacing) newNode.data.spacing = [...newNode.data.spacing];

                  addNode(newNode);
                }
                setMenu(null);
              }}
            >
              Duplicate Node
            </button>
          )}
          <button 
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-900 rounded-lg font-medium transition-colors"
            onClick={() => {
              if (menu.type === 'node') removeNode(menu.id);
              if (menu.type === 'edge') removeEdge(menu.id);
              setMenu(null);
            }}
          >
            Delete {menu.type === 'node' ? 'Node' : 'Connection'}
          </button>
        </div>
      )}
    </div>
  );
}
