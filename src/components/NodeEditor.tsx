"use client";

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore, AppNode } from '@/store/useStore';
import { OutputNode, PrimitiveNode, BooleanNode, LatticeNode, MeshNode, ModifierNode } from './EditorNodes';
import { useMemo, useState, useCallback } from 'react';

// @ts-ignore
const nodeTypes = {
  outputNode: OutputNode,
  primitiveNode: PrimitiveNode,
  booleanNode: BooleanNode,
  latticeNode: LatticeNode,
  meshNode: MeshNode,
  modifierNode: ModifierNode,
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
        newNode = { id, type: 'primitiveNode', position, data: { type: 'primitive', name: 'Primitive', shape: 'box', position: [0, 0, 0], scale: 2 } };
        break;
      case 'boolean':
        newNode = { id, type: 'booleanNode', position, data: { type: 'boolean', name: 'Boolean', operation: 'union', smoothness: 1.0 } };
        break;
      case 'lattice':
        newNode = { id, type: 'latticeNode', position, data: { type: 'lattice', name: 'Lattice', pattern: 'gyroid', scale: 5, thickness: 0.1 } };
        break;
      default: return;
    }
    
    addNode(newNode);
  };

  return (
    <div className="w-full h-full relative bg-zinc-950">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button onClick={() => handleAddNode('primitive')} className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-zinc-700">
          + Primitive
        </button>
        <button onClick={() => handleAddNode('boolean')} className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-zinc-700">
          + Boolean
        </button>
        <button onClick={() => handleAddNode('lattice')} className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-zinc-700">
          + Lattice
        </button>
          <button 
            onClick={() => addNode({ id: 'mod_' + Date.now(), type: 'modifierNode', position: { x: 200, y: 200 }, data: { type: 'modifier', name: 'Modifier', modifierType: 'shell', amount: 0.1 } })}
            className="bg-yellow-900/50 hover:bg-yellow-800/50 border border-yellow-700 text-yellow-300 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
          >
            + Modifier
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
        <Background color="#333" gap={16} />
        <Controls className="!bg-zinc-800 !border-zinc-700 !fill-zinc-300" />
      </ReactFlow>

      {menu && (
        <div 
          className="fixed z-[9999] bg-zinc-900 border border-zinc-700 shadow-xl rounded-lg p-1 min-w-[120px]"
          style={{ top: menu.top, left: menu.left }}
        >
          <button 
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-800 rounded font-medium transition-colors"
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
