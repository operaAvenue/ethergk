import { Handle, Position, NodeProps } from '@xyflow/react';
import { useStore, PrimitiveNodeData, BooleanNodeData, LatticeNodeData, MeshNodeData, ModifierNodeData } from '@/store/useStore';
import { Box, Circle, Cylinder, Plus, Waves, LayoutTemplate } from 'lucide-react';

function NodeWrapper({ title, icon, children, outputOnly = false }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl w-64 text-zinc-200 text-xs overflow-hidden">
      <div className="bg-zinc-800 px-3 py-2 border-b border-zinc-700 flex items-center gap-2">
        {icon}
        <span className="font-bold">{title}</span>
      </div>
      <div className="p-3 flex flex-col gap-3 relative">
        {!outputOnly && (
          <Handle type="target" position={Position.Left} id="base" className="w-3 h-3 bg-fuchsia-500 border-2 border-zinc-900" style={{ top: 15 }} />
        )}
        {children}
        <Handle type="source" position={Position.Right} id="out" className="w-3 h-3 bg-indigo-500 border-2 border-zinc-900" />
      </div>
    </div>
  );
}

export function OutputNode(props: NodeProps) {
  return (
    <div className="bg-indigo-900 border-2 border-indigo-500 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.5)] w-48 text-zinc-100 text-xs overflow-hidden">
      <div className="px-3 py-3 flex items-center justify-center gap-2 font-bold text-sm">
        <LayoutTemplate className="w-4 h-4" /> Final Render
      </div>
      <Handle type="target" position={Position.Left} id="base" className="w-4 h-4 bg-indigo-300 border-2 border-zinc-900" />
    </div>
  );
}

export function PrimitiveNode(props: NodeProps<any>) {
  const data = props.data as PrimitiveNodeData;
  const updateNodeData = useStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Primitive Shape" icon={<Box className="w-4 h-4 text-emerald-400" />} outputOnly>
      <div className="flex bg-zinc-950 p-1 rounded-lg">
        {(['sphere', 'box', 'cylinder'] as const).map(shape => (
          <button
            key={shape}
            onClick={() => updateNodeData(props.id, { shape })}
            className={`flex-1 py-1 rounded-md capitalize font-medium ${data.shape === shape ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {shape}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500 flex justify-between items-center">
          Scale 
          <input type="number" step="0.1" value={data.scale} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
        </label>
        <input type="range" min="0.1" max="10.0" step="0.1" value={data.scale} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-full accent-emerald-500 nodrag" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="space-y-1">
             <label className="text-[10px] text-zinc-500">{axis}</label>
             <input type="number" step="0.5" value={data.position[i]} onChange={(e) => {
               const pos = [...data.position]; pos[i] = parseFloat(e.target.value);
               updateNodeData(props.id, { position: pos as any });
             }} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1 text-center nodrag" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800 mt-1">
         <label className="text-[10px] text-zinc-500">Ghost Color</label>
         <input type="color" value={data.color || '#6366f1'} onChange={(e) => updateNodeData(props.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent nodrag" />
      </div>
    </NodeWrapper>
  );
}

export function MeshNode(props: NodeProps<any>) {
  const data = props.data as MeshNodeData;
  const updateNodeData = useStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Imported STL" icon={<Box className="w-4 h-4 text-orange-400" />} outputOnly>
      <div className="truncate text-orange-200 bg-orange-900/30 p-2 rounded border border-orange-800/50 text-center" title={data.name}>
        {data.name}
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500 flex justify-between items-center">
          Scale 
          <input type="number" step="0.1" value={data.scale || 1.0} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
        </label>
        <input type="range" min="0.1" max="10.0" step="0.1" value={data.scale || 1.0} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-full accent-orange-500 nodrag" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="space-y-1">
             <label className="text-[10px] text-zinc-500">{axis}</label>
             <input type="number" step="0.5" value={data.position ? data.position[i] : 0} onChange={(e) => {
               const pos = data.position ? [...data.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
               updateNodeData(props.id, { position: pos as any });
             }} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1 text-center nodrag" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800 mt-1">
         <label className="text-[10px] text-zinc-500">Ghost Color</label>
         <input type="color" value={data.color || '#f97316'} onChange={(e) => updateNodeData(props.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent nodrag" />
      </div>
    </NodeWrapper>
  );
}

export function BooleanNode(props: NodeProps<any>) {
  const data = props.data as BooleanNodeData;
  const updateNodeData = useStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Boolean Operation" icon={<Plus className="w-4 h-4 text-fuchsia-400" />}>
      <Handle type="target" position={Position.Left} id="tool" className="w-3 h-3 bg-red-500 border-2 border-zinc-900" style={{ top: 50 }} />
      <div className="text-[10px] text-zinc-500 mb-1">Base (Top) / Tool (Bottom)</div>
      
      <select 
        value={data.operation}
        onChange={(e) => updateNodeData(props.id, { operation: e.target.value as any })}
        className="w-full bg-zinc-950 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none nodrag"
      >
        <option value="union">Union</option>
        <option value="subtract">Subtract</option>
        <option value="intersect">Intersect</option>
        <option value="smoothUnion">Smooth Union</option>
        <option value="smoothSubtract">Smooth Subtract</option>
        <option value="smoothIntersect">Smooth Intersect</option>
      </select>

      {data.operation.includes('smooth') && (
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 flex justify-between items-center">
            Smoothness 
            <input type="number" step="0.1" value={data.smoothness} onChange={(e) => updateNodeData(props.id, { smoothness: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
          </label>
          <input type="range" min="0.1" max="5.0" step="0.1" value={data.smoothness} onChange={(e) => updateNodeData(props.id, { smoothness: parseFloat(e.target.value) })} className="w-full accent-fuchsia-500 nodrag" />
        </div>
      )}
    </NodeWrapper>
  );
}

export function LatticeNode(props: NodeProps<any>) {
  const data = props.data as LatticeNodeData;
  const updateNodeData = useStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Lattice Infill" icon={<Waves className="w-4 h-4 text-cyan-400" />}>
      <select 
        value={data.pattern || 'gyroid'}
        onChange={(e) => updateNodeData(props.id, { pattern: e.target.value as any })}
        className="w-full bg-zinc-950 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag"
      >
        <option value="gyroid">Gyroid</option>
        <option value="schwarzP">Schwarz P</option>
        <option value="diamond">Diamond</option>
        <option value="neovius">Neovius</option>
        <option value="iwp">Schoen I-WP</option>
        <option value="frd">Schoen F-RD</option>
      </select>
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500 flex justify-between items-center">
          Pattern Scale 
          <input type="number" step="0.5" value={data.scale} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
        </label>
        <input type="range" min="1.0" max="20.0" step="0.5" value={data.scale} onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} className="w-full accent-cyan-500 nodrag" />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500 flex justify-between items-center">
          Thickness 
          <input type="number" step="0.01" value={data.thickness} onChange={(e) => updateNodeData(props.id, { thickness: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
        </label>
        <input type="range" min="0.01" max="1.0" step="0.01" value={data.thickness} onChange={(e) => updateNodeData(props.id, { thickness: parseFloat(e.target.value) })} className="w-full accent-cyan-500 nodrag" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800 mt-1">
         <label className="text-[10px] text-zinc-500">Infill Color</label>
         <input type="color" value={data.color || '#06b6d4'} onChange={(e) => updateNodeData(props.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent nodrag" />
      </div>
    </NodeWrapper>
  );
}

export function ModifierNode(props: NodeProps<any>) {
  const data = props.data as ModifierNodeData;
  const updateNodeData = useStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Modifier" icon={<Plus className="w-4 h-4 text-yellow-400" />}>
      <select 
        value={data.modifierType || 'shell'}
        onChange={(e) => updateNodeData(props.id, { modifierType: e.target.value as any })}
        className="w-full bg-zinc-950 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag"
      >
        <option value="shell">Shell (Hollow)</option>
        <option value="offset">Offset (Thicken/Shrink)</option>
      </select>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500 flex justify-between items-center">
          Amount 
          <input type="number" step="0.05" value={data.amount || 0} onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} className="w-12 bg-zinc-950 border border-zinc-800 rounded px-1 text-center nodrag" />
        </label>
        <input type="range" min="-2.0" max="2.0" step="0.05" value={data.amount || 0} onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} className="w-full accent-yellow-500 nodrag" />
      </div>
    </NodeWrapper>
  );
}
