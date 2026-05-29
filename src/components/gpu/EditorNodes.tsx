import { Handle, Position, NodeProps } from '@xyflow/react';
import { useGpuStore, PrimitiveNodeData, BooleanNodeData, LatticeNodeData, MeshNodeData, ModifierNodeData, TransformNodeData, DeformNodeData, RepeatNodeData, MorphNodeData, SymmetryNodeData } from '@/store/useGpuStore';
import { Box, Circle, Cylinder, Plus, Waves, LayoutTemplate, Move, Rotate3D, AlignHorizontalSpaceAround, Blend } from 'lucide-react';

const num = (v: any) => (typeof v === 'number' && Number.isNaN(v)) ? '' : v;

function NodeWrapper({ title, icon, children, outputOnly = false }: any) {
  return (
    <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800/80 rounded-xl shadow-2xl w-64 text-zinc-300 text-xs overflow-hidden transition-all duration-200 hover:border-zinc-700">
      <div className="bg-zinc-900/90 px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2">
        {icon}
        <span className="font-bold text-zinc-100 uppercase tracking-wider text-[10px]">{title}</span>
      </div>
      <div className="p-3 flex flex-col gap-3 relative">
        {!outputOnly && (
          <Handle 
            type="target" 
            position={Position.Left} 
            id="base" 
            className="w-3 h-3 bg-zinc-600 border border-zinc-950 rounded-full hover:bg-amber-400 transition-colors" 
            style={{ top: 18 }} 
          />
        )}
        {children}
        <Handle 
          type="source" 
          position={Position.Right} 
          id="out" 
          className="w-3 h-3 bg-amber-500 border border-zinc-950 rounded-full hover:bg-amber-400 transition-colors shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
        />
      </div>
    </div>
  );
}

export function OutputNode(props: NodeProps) {
  return (
    <div className="bg-zinc-950 border-2 border-amber-500 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.15)] w-48 text-zinc-100 text-xs overflow-hidden hover:border-amber-400 transition-all duration-200">
      <div className="px-3 py-3.5 flex items-center justify-center gap-2 font-bold text-sm text-amber-500 uppercase tracking-widest">
        <LayoutTemplate className="w-4 h-4 text-amber-500" /> Final Render
      </div>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="base" 
        className="w-3.5 h-3.5 bg-amber-500 border border-zinc-950 rounded-full hover:bg-amber-400 transition-colors" 
      />
    </div>
  );
}

export function PrimitiveNode(props: NodeProps<any>) {
  const data = props.data as PrimitiveNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Primitive Shape" icon={<Box className="w-4 h-4 text-zinc-400" />} outputOnly>
      <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800/80">
        {(['sphere', 'box', 'cylinder'] as const).map(shape => (
          <button
            key={shape}
            onClick={() => updateNodeData(props.id, { shape })}
            className={`flex-1 py-1 rounded-md capitalize font-semibold text-[10px] transition-all duration-150 ${data.shape === shape ? 'bg-zinc-850 border border-zinc-750 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {shape}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Scale</span>
          <input 
            type="number" 
            step="0.1" 
            value={num(data.scale)} 
            onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="0.1" 
          max="10.0" 
          step="0.1" 
          value={num(data.scale)} 
          onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="space-y-1">
             <label className="text-[10px] text-zinc-500 font-bold block text-center">{axis}</label>
             <input 
               type="number" 
               step="0.5" 
               value={num(data.position[i])} 
               onChange={(e) => {
                 const pos = [...data.position]; pos[i] = parseFloat(e.target.value);
                 updateNodeData(props.id, { position: pos as any });
               }} 
               className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none text-[11px]" 
             />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 mt-1">
         <label className="text-[10px] text-zinc-500">Color</label>
         <input 
           type="color" 
           value={data.color || '#6366f1'} 
           onChange={(e) => updateNodeData(props.id, { color: e.target.value })} 
           className="w-6 h-6 rounded-full cursor-pointer border border-zinc-800/80 p-0 bg-transparent nodrag overflow-hidden" 
         />
      </div>
    </NodeWrapper>
  );
}

export function MeshNode(props: NodeProps<any>) {
  const data = props.data as MeshNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Imported STL" icon={<Box className="w-4 h-4 text-zinc-400" />} outputOnly>
      <div className="truncate text-zinc-300 bg-zinc-900 border border-zinc-800/85 p-2 rounded text-center text-[11px] font-mono font-medium" title={data.name}>
        {data.name}
      </div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Scale</span>
          <input 
            type="number" 
            step="0.1" 
            value={num(data.scale || 1.0)} 
            onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="0.1" 
          max="10.0" 
          step="0.1" 
          value={num(data.scale || 1.0)} 
          onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="space-y-1">
             <label className="text-[10px] text-zinc-500 font-bold block text-center">{axis}</label>
             <input 
               type="number" 
               step="0.5" 
               value={num(data.position ? data.position[i] : 0)} 
               onChange={(e) => {
                 const pos = data.position ? [...data.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
                 updateNodeData(props.id, { position: pos as any });
               }} 
               className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none text-[11px]" 
             />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 mt-1">
         <label className="text-[10px] text-zinc-500">Color</label>
         <input 
           type="color" 
           value={data.color || '#f97316'} 
           onChange={(e) => updateNodeData(props.id, { color: e.target.value })} 
           className="w-6 h-6 rounded-full cursor-pointer border border-zinc-800/80 p-0 bg-transparent nodrag overflow-hidden" 
         />
      </div>
    </NodeWrapper>
  );
}

export function BooleanNode(props: NodeProps<any>) {
  const data = props.data as BooleanNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Boolean Operation" icon={<Plus className="w-4 h-4 text-zinc-400" />}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="tool" 
        className="w-3 h-3 bg-zinc-650 border border-zinc-950 rounded-full hover:bg-amber-400 transition-colors" 
        style={{ top: 56 }} 
      />
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Base (Top) / Tool (Bottom)</div>
      
      <select 
        value={data.operation}
        onChange={(e) => updateNodeData(props.id, { operation: e.target.value as any })}
        className="w-full bg-zinc-900 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none nodrag focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 text-xs"
      >
        <option value="union">Union</option>
        <option value="subtract">Subtract</option>
        <option value="intersect">Intersect</option>
        <option value="smoothUnion">Smooth Union</option>
        <option value="smoothSubtract">Smooth Subtract</option>
        <option value="smoothIntersect">Smooth Intersect</option>
      </select>

      {data.operation.includes('smooth') && (
        <div className="space-y-1.5 mt-1">
          <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span>Smoothness</span>
            <input 
              type="number" 
              step="0.1" 
              value={num(data.smoothness)} 
              onChange={(e) => updateNodeData(props.id, { smoothness: parseFloat(e.target.value) })} 
              className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
            />
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="5.0" 
            step="0.1" 
            value={num(data.smoothness)} 
            onChange={(e) => updateNodeData(props.id, { smoothness: parseFloat(e.target.value) })} 
            className="w-full accent-amber-500 nodrag cursor-pointer" 
          />
        </div>
      )}
    </NodeWrapper>
  );
}

export function LatticeNode(props: NodeProps<any>) {
  const data = props.data as LatticeNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Lattice Infill" icon={<Waves className="w-4 h-4 text-zinc-400" />}>
      <select 
        value={data.pattern || 'gyroid'}
        onChange={(e) => updateNodeData(props.id, { pattern: e.target.value as any })}
        className="w-full bg-zinc-900 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
      >
        <optgroup label="TPMS Structures">
          <option value="gyroid">Gyroid</option>
          <option value="schwarzP">Schwarz P</option>
          <option value="diamond">Diamond</option>
          <option value="neovius">Neovius</option>
          <option value="iwp">Schoen I-WP</option>
          <option value="frd">Schoen F-RD</option>
          <option value="lidinoid">Lidinoid</option>
          <option value="schwarzH">Schwarz H (Hex)</option>
          <option value="tubularGyroid">Tubular Gyroid</option>
          <option value="fischerKochS">Fischer-Koch S</option>
          <option value="fischerKochD">Fischer-Koch D</option>
          <option value="splitP">Split P</option>
          <option value="gPrime">Schoen G-Prime</option>
          <option value="iwp2">I-WP Variant</option>
          <option value="carlyle">Carlyle</option>
          <option value="crossedDecagons">Crossed Decagons</option>
        </optgroup>
        <optgroup label="Lattices & Infill">
          <option value="grid">3D Grid</option>
          <option value="honeycomb">Honeycomb</option>
          <option value="octet">Octet Truss</option>
          <option value="cylindricalGrid">Cylindrical Grid</option>
          <option value="kelvin">Kelvin Cell</option>
          <option value="kagome">Kagome Lattice</option>
          <option value="waffle">Waffle Lattice</option>
          <option value="chiral">Chiral Gyroid</option>
          <option value="radialGrid">Radial Grid</option>
          <option value="herringbone">Herringbone</option>
          <option value="weairePhelan">Weaire-Phelan</option>
          <option value="boxFrame">Box Frame</option>
          <option value="octahedral">Octahedral Frame</option>
        </optgroup>
        <optgroup label="Textures & Pores">
          <option value="foam">Spherical Foam</option>
          <option value="fractalNoise">Fractal Noise</option>
          <option value="sineWave">Sine Ripple</option>
        </optgroup>
      </select>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Pattern Scale</span>
          <input 
            type="number" 
            step="1" 
            value={num(data.scale)} 
            onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="10" 
          max="2000" 
          step="1" 
          value={num(data.scale)} 
          onChange={(e) => updateNodeData(props.id, { scale: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Thickness</span>
          <input 
            type="number" 
            step="0.01" 
            value={num(data.thickness)} 
            onChange={(e) => updateNodeData(props.id, { thickness: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="0.01" 
          max="1.0" 
          step="0.01" 
          value={num(data.thickness)} 
          onChange={(e) => updateNodeData(props.id, { thickness: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 mt-1">
         <label className="text-[10px] text-zinc-500">Infill Color</label>
         <input 
           type="color" 
           value={data.color || '#06b6d4'} 
           onChange={(e) => updateNodeData(props.id, { color: e.target.value })} 
           className="w-6 h-6 rounded-full cursor-pointer border border-zinc-800/80 p-0 bg-transparent nodrag overflow-hidden" 
         />
      </div>
    </NodeWrapper>
  );
}

export function ModifierNode(props: NodeProps<any>) {
  const data = props.data as ModifierNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Modifier" icon={<Plus className="w-4 h-4 text-zinc-400" />}>
      <select 
        value={data.modifierType || 'shell'}
        onChange={(e) => updateNodeData(props.id, { modifierType: e.target.value as any })}
        className="w-full bg-zinc-900 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
      >
        <option value="shell">Shell (Hollow)</option>
        <option value="offset">Offset (Thicken/Shrink)</option>
      </select>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Amount</span>
          <input 
            type="number" 
            step="0.05" 
            value={num(data.amount || 0)} 
            onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="-2.0" 
          max="2.0" 
          step="0.05" 
          value={num(data.amount || 0)} 
          onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
    </NodeWrapper>
  );
}

export function TransformNode(props: NodeProps<any>) {
  const data = props.data as TransformNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Transform" icon={<Move className="w-4 h-4 text-zinc-400" />}>
      {['translate', 'rotate', 'scale'].map((type) => (
        <div key={type} className="mb-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold mb-1">{type}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <input 
                key={axis} 
                type="number" 
                step={type === 'scale' ? "0.1" : (type === 'rotate' ? "15" : "0.5")} 
                value={num(data[type as 'translate'|'rotate'|'scale']?.[i] ?? (type === 'scale' ? 1 : 0))} 
                onChange={(e) => {
                  const arr = data[type as 'translate'|'rotate'|'scale'] ? [...data[type as 'translate'|'rotate'|'scale']] : (type === 'scale' ? [1,1,1] : [0,0,0]);
                  arr[i] = parseFloat(e.target.value);
                  updateNodeData(props.id, { [type]: arr });
                }} 
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none text-[10px]" 
              />
            ))}
          </div>
        </div>
      ))}
    </NodeWrapper>
  );
}

export function DeformNode(props: NodeProps<any>) {
  const data = props.data as DeformNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Deform" icon={<Rotate3D className="w-4 h-4 text-zinc-400" />}>
      <select 
        value={data.deformType || 'twist'}
        onChange={(e) => updateNodeData(props.id, { deformType: e.target.value as any })}
        className="w-full bg-zinc-900 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
      >
        <option value="twist">Twist</option>
        <option value="taper">Taper</option>
        <option value="bend">Bend</option>
        <option value="quantize">Quantize / Pixelate</option>
        <option value="ripple">Surface Ripple</option>
        <option value="elongateX">Elongate X</option>
        <option value="elongateY">Elongate Y</option>
        <option value="bulge">Bulge</option>
        <option value="pinch">Pinch</option>
      </select>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Strength</span>
          <input 
            type="number" 
            step="0.1" 
            value={num(data.strength || 0)} 
            onChange={(e) => updateNodeData(props.id, { strength: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="-5.0" 
          max="5.0" 
          step="0.1" 
          value={num(data.strength || 0)} 
          onChange={(e) => updateNodeData(props.id, { strength: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
    </NodeWrapper>
  );
}

export function RepeatNode(props: NodeProps<any>) {
  const data = props.data as RepeatNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Array / Repeat" icon={<AlignHorizontalSpaceAround className="w-4 h-4 text-zinc-400" />}>
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Spacing (0 = disable axis)</div>
      <div className="grid grid-cols-3 gap-1.5 mb-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="space-y-1">
            <label className="text-[10px] text-zinc-500 text-center font-bold block">{axis}</label>
            <input 
              type="number" 
              step="0.5" 
              value={num(data.spacing?.[i] ?? 0)} 
              onChange={(e) => {
                const arr = data.spacing ? [...data.spacing] : [0,0,0];
                arr[i] = parseFloat(e.target.value);
                updateNodeData(props.id, { spacing: arr as any });
              }} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none text-[10px]" 
            />
          </div>
        ))}
      </div>
    </NodeWrapper>
  );
}

export function MorphNode(props: NodeProps<any>) {
  const data = props.data as MorphNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Morph Blend" icon={<Blend className="w-4 h-4 text-zinc-400" />}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="shapeB" 
        className="w-3 h-3 bg-zinc-650 border border-zinc-950 rounded-full hover:bg-amber-400 transition-colors" 
        style={{ top: 56 }} 
      />
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2 block">Shape A (Top) / Shape B (Bottom)</div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
          <span>Blend Amount</span>
          <input 
            type="number" 
            step="0.05" 
            value={num(data.amount || 0)} 
            onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} 
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
          />
        </div>
        <input 
          type="range" 
          min="0.0" 
          max="1.0" 
          step="0.01" 
          value={num(data.amount || 0)} 
          onChange={(e) => updateNodeData(props.id, { amount: parseFloat(e.target.value) })} 
          className="w-full accent-amber-500 nodrag cursor-pointer" 
        />
      </div>
    </NodeWrapper>
  );
}

export function SymmetryNode(props: NodeProps<any>) {
  const data = props.data as SymmetryNodeData;
  const updateNodeData = useGpuStore(state => state.updateNodeData);

  return (
    <NodeWrapper title="Symmetry" icon={<Move className="w-4 h-4 text-zinc-400" />}>
      <select 
        value={data.symType || 'symX'}
        onChange={(e) => updateNodeData(props.id, { symType: e.target.value as any })}
        className="w-full bg-zinc-900 text-zinc-300 p-2 rounded-lg border border-zinc-800 outline-none mb-1 text-xs nodrag focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
      >
        <option value="symX">Mirror X</option>
        <option value="symY">Mirror Y</option>
        <option value="symZ">Mirror Z</option>
        <option value="radial">Radial / Kaleidoscope</option>
      </select>

      {data.symType === 'radial' && (
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span>Slices</span>
            <input 
              type="number" 
              step="1" 
              value={num(data.slices || 6)} 
              onChange={(e) => updateNodeData(props.id, { slices: parseInt(e.target.value) })} 
              className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-center nodrag text-zinc-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none" 
            />
          </div>
          <input 
            type="range" 
            min="2" 
            max="32" 
            step="1" 
            value={num(data.slices || 6)} 
            onChange={(e) => updateNodeData(props.id, { slices: parseInt(e.target.value) })} 
            className="w-full accent-amber-500 nodrag cursor-pointer" 
          />
        </div>
      )}
    </NodeWrapper>
  );
}
