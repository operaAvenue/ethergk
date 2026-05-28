"use client";

import { useGpuStore, AppNode } from '@/store/useGpuStore';
import { Box, Plus, Waves, LayoutTemplate, Rotate3D, Grid, SlidersHorizontal, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';

const num = (v: any) => (typeof v === 'number' && Number.isNaN(v)) ? '' : v;

function NodePanel({ node, children, icon, title, color }: any) {
  const [expanded, setExpanded] = useState(true);
  const removeNode = useGpuStore(state => state.removeNode);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-3 overflow-hidden shadow-lg">
      <div 
        className="px-3 py-2 bg-zinc-800/50 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`text-${color}-400`}>{icon}</div>
          <span className="font-bold text-xs text-zinc-200">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
            className="p-1 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>
      {expanded && (
        <div className="p-3 flex flex-col gap-3 text-xs">
          {children}
        </div>
      )}
    </div>
  );
}

export function SidebarEditor() {
  const { nodes, updateNodeData } = useGpuStore();

  // Filter out the output node, show others
  const modifiers = nodes.filter(n => n.type !== 'outputNode' && n.data?.type !== 'output');

  const renderNodeControls = (node: AppNode) => {
    const d = node.data as any;
    
    if (d.type === 'primitive') {
      return (
        <NodePanel node={node} title="Primitive" icon={<Box className="w-4 h-4" />} color="emerald">
          <select 
            value={d.shape} 
            onChange={(e) => updateNodeData(node.id, { shape: e.target.value })}
            className="w-full bg-zinc-950 text-zinc-300 p-1.5 rounded border border-zinc-800 outline-none"
          >
            <option value="box">Box</option>
            <option value="sphere">Sphere</option>
            <option value="cylinder">Cylinder</option>
          </select>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 flex justify-between">Scale <span>{d.scale?.toFixed(2)}</span></label>
            <input type="range" min="0.1" max="10.0" step="0.1" value={num(d.scale || 1.0)} onChange={(e) => updateNodeData(node.id, { scale: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500">Position (X, Y, Z)</label>
            <div className="flex gap-1">
              {['x', 'y', 'z'].map((axis, i) => (
                 <input key={axis} type="number" step="0.5" value={num(d.position ? d.position[i] : 0)} onChange={(e) => {
                   const pos = d.position ? [...d.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
                   updateNodeData(node.id, { position: pos as any });
                 }} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1 text-center" />
              ))}
            </div>
          </div>
        </NodePanel>
      );
    }
    
    if (d.type === 'mesh') {
      return (
        <NodePanel node={node} title={`Mesh: ${d.name || 'Imported'}`} icon={<Rotate3D className="w-4 h-4" />} color="orange">
          <div className="text-[10px] text-zinc-400">Position (X, Y, Z)</div>
          <div className="flex gap-1">
            {['x', 'y', 'z'].map((axis, i) => (
               <input key={axis} type="number" step="0.5" value={num(d.position ? d.position[i] : 0)} onChange={(e) => {
                 const pos = d.position ? [...d.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
                 updateNodeData(node.id, { position: pos as any });
               }} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1 text-center" />
            ))}
          </div>
        </NodePanel>
      );
    }

    if (d.type === 'boolean') {
      return (
        <NodePanel node={node} title="Boolean" icon={<Plus className="w-4 h-4" />} color="fuchsia">
          <select 
            value={d.operation}
            onChange={(e) => updateNodeData(node.id, { operation: e.target.value as any })}
            className="w-full bg-zinc-950 text-zinc-300 p-1.5 rounded border border-zinc-800 outline-none"
          >
            <option value="union">Union</option>
            <option value="subtract">Subtract</option>
            <option value="intersect">Intersect</option>
            <option value="smoothUnion">Smooth Union</option>
            <option value="smoothSubtract">Smooth Subtract</option>
            <option value="smoothIntersect">Smooth Intersect</option>
          </select>
          {d.operation.includes('smooth') && (
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 flex justify-between">Smoothness <span>{d.smoothness?.toFixed(2)}</span></label>
              <input type="range" min="0.1" max="5.0" step="0.1" value={num(d.smoothness || 0.1)} onChange={(e) => updateNodeData(node.id, { smoothness: parseFloat(e.target.value) })} className="w-full accent-fuchsia-500" />
            </div>
          )}
        </NodePanel>
      );
    }

    if (d.type === 'lattice') {
      return (
        <NodePanel node={node} title="Lattice" icon={<Grid className="w-4 h-4" />} color="cyan">
          <select 
            value={d.pattern}
            onChange={(e) => updateNodeData(node.id, { pattern: e.target.value as any })}
            className="w-full bg-zinc-950 text-zinc-300 p-1.5 rounded border border-zinc-800 outline-none"
          >
            <option value="gyroid">Gyroid</option>
            <option value="schwarzP">Schwarz P</option>
            <option value="diamond">Diamond</option>
            <option value="grid">Grid</option>
          </select>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 flex justify-between">Scale <span>{d.scale?.toFixed(0)}</span></label>
            <input type="range" min="10" max="2000" step="1" value={num(d.scale || 10.0)} onChange={(e) => updateNodeData(node.id, { scale: parseFloat(e.target.value) })} className="w-full accent-cyan-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 flex justify-between">Thickness <span>{d.thickness?.toFixed(2)}</span></label>
            <input type="range" min="0.01" max="1.0" step="0.01" value={num(d.thickness || 0.1)} onChange={(e) => updateNodeData(node.id, { thickness: parseFloat(e.target.value) })} className="w-full accent-cyan-500" />
          </div>
        </NodePanel>
      );
    }

    if (d.type === 'modifier') {
      return (
        <NodePanel node={node} title="Modifier" icon={<Waves className="w-4 h-4" />} color="yellow">
          <select 
            value={d.modifierType}
            onChange={(e) => updateNodeData(node.id, { modifierType: e.target.value as any })}
            className="w-full bg-zinc-950 text-zinc-300 p-1.5 rounded border border-zinc-800 outline-none"
          >
            <option value="shell">Shell</option>
            <option value="offset">Offset</option>
          </select>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 flex justify-between">Amount <span>{d.amount?.toFixed(2)}</span></label>
            <input type="range" min="-2.0" max="2.0" step="0.05" value={num(d.amount || 0)} onChange={(e) => updateNodeData(node.id, { amount: parseFloat(e.target.value) })} className="w-full accent-yellow-500" />
          </div>
        </NodePanel>
      );
    }

    return (
      <NodePanel node={node} title={d.name || d.type} icon={<SlidersHorizontal className="w-4 h-4" />} color="zinc">
        <div className="text-[10px] text-zinc-500 italic">Settings not available in Sidebar yet. Switch to Node Editor.</div>
      </NodePanel>
    );
  };

  return (
    <div className="w-full h-full bg-zinc-950 border border-zinc-800 overflow-y-auto p-4 custom-scrollbar">
      <div className="mb-4 pb-2 border-b border-zinc-800 flex items-center gap-2 text-zinc-300">
        <SlidersHorizontal className="w-5 h-5" />
        <h3 className="font-bold">Stack Editor</h3>
      </div>
      
      {modifiers.length === 0 ? (
        <div className="text-center text-zinc-500 mt-10 text-sm">
          No items in the stack.<br/> Switch to Node Editor to add items.
        </div>
      ) : (
        <div className="flex flex-col">
          {modifiers.slice().reverse().map(node => (
            <div key={node.id}>
              {renderNodeControls(node)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
