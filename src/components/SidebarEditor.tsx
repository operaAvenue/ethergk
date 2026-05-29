"use client";

import { useStore, AppNode } from '@/store/useStore';
import { Box, Plus, Waves, Rotate3D, Grid, SlidersHorizontal, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';

const num = (v: any) => (typeof v === 'number' && Number.isNaN(v)) ? '' : v;

function NodePanel({ node, children, icon, title }: any) {
  const [expanded, setExpanded] = useState(true);
  const removeNode = useStore(state => state.removeNode);

  return (
    <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl mb-3 overflow-hidden shadow-md">
      <div 
        className="px-3 py-2.5 bg-zinc-900/60 flex items-center justify-between cursor-pointer hover:bg-zinc-900 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="text-amber-500">{icon}</div>
          <span className="font-bold text-xs text-zinc-200 tracking-wide uppercase text-[10px]">{title}</span>
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
        <div className="p-3 flex flex-col gap-3 text-xs text-zinc-350">
          {children}
        </div>
      )}
    </div>
  );
}

export function SidebarEditor() {
  const { nodes, updateNodeData } = useStore();

  const modifiers = nodes.filter(n => n.type !== 'outputNode' && n.data?.type !== 'output');

  const renderNodeControls = (node: AppNode) => {
    const d = node.data as any;
    
    if (d.type === 'primitive') {
      return (
        <NodePanel node={node} title="Primitive" icon={<Box className="w-4 h-4" />}>
          <select 
            value={d.shape} 
            onChange={(e) => updateNodeData(node.id, { shape: e.target.value })}
            className="w-full bg-zinc-900 text-zinc-300 p-1.5 rounded-lg border border-zinc-800 outline-none text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
          >
            <option value="box">Box</option>
            <option value="sphere">Sphere</option>
            <option value="cylinder">Cylinder</option>
          </select>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 flex justify-between font-medium">Scale <span>{d.scale?.toFixed(2)}</span></label>
            <input type="range" min="0.1" max="10.0" step="0.1" value={num(d.scale || 1.0)} onChange={(e) => updateNodeData(node.id, { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 font-medium">Position (X, Y, Z)</label>
            <div className="flex gap-1.5">
              {['x', 'y', 'z'].map((axis, i) => (
                 <input 
                   key={axis} 
                   type="number" 
                   step="0.5" 
                   value={num(d.position ? d.position[i] : 0)} 
                   onChange={(e) => {
                     const pos = d.position ? [...d.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
                     updateNodeData(node.id, { position: pos as any });
                   }} 
                   className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center text-zinc-300 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 text-[11px]" 
                 />
              ))}
            </div>
          </div>
        </NodePanel>
      );
    }
    
    if (d.type === 'mesh') {
      return (
        <NodePanel node={node} title={`Mesh: ${d.name || 'Imported'}`} icon={<Rotate3D className="w-4 h-4" />}>
          <div className="text-[10px] text-zinc-500 font-medium">Position (X, Y, Z)</div>
          <div className="flex gap-1.5">
            {['x', 'y', 'z'].map((axis, i) => (
               <input 
                 key={axis} 
                 type="number" 
                 step="0.5" 
                 value={num(d.position ? d.position[i] : 0)} 
                 onChange={(e) => {
                   const pos = d.position ? [...d.position] : [0,0,0]; pos[i] = parseFloat(e.target.value);
                   updateNodeData(node.id, { position: pos as any });
                 }} 
                 className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-center text-zinc-300 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 text-[11px]" 
               />
            ))}
          </div>
        </NodePanel>
      );
    }

    if (d.type === 'boolean') {
      return (
        <NodePanel node={node} title="Boolean" icon={<Plus className="w-4 h-4" />}>
          <select 
            value={d.operation}
            onChange={(e) => updateNodeData(node.id, { operation: e.target.value as any })}
            className="w-full bg-zinc-900 text-zinc-300 p-1.5 rounded-lg border border-zinc-800 outline-none text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
          >
            <option value="union">Union</option>
            <option value="subtract">Subtract</option>
            <option value="intersect">Intersect</option>
            <option value="smoothUnion">Smooth Union</option>
            <option value="smoothSubtract">Smooth Subtract</option>
            <option value="smoothIntersect">Smooth Intersect</option>
          </select>
          {d.operation.includes('smooth') && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500 flex justify-between font-medium">Smoothness <span>{d.smoothness?.toFixed(2)}</span></label>
              <input type="range" min="0.1" max="5.0" step="0.1" value={num(d.smoothness || 0.1)} onChange={(e) => updateNodeData(node.id, { smoothness: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
            </div>
          )}
        </NodePanel>
      );
    }

    if (d.type === 'lattice') {
      return (
        <NodePanel node={node} title="Lattice" icon={<Grid className="w-4 h-4" />}>
          <select 
            value={d.pattern}
            onChange={(e) => updateNodeData(node.id, { pattern: e.target.value as any })}
            className="w-full bg-zinc-900 text-zinc-300 p-1.5 rounded-lg border border-zinc-800 outline-none text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
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
            <optgroup label="Double &amp; Tubular Lattices">
              <option value="doubleGyroid">Double Gyroid</option>
              <option value="doubleSchwarzP">Double Schwarz P</option>
              <option value="doubleDiamond">Double Diamond</option>
              <option value="tubularDiamond">Tubular Diamond</option>
              <option value="tubularSchwarzP">Tubular Schwarz P</option>
              <option value="tubularNeovius">Tubular Neovius</option>
              <option value="tubularLidinoid">Tubular Lidinoid</option>
              <option value="superGyroid">Super-Gyroid</option>
              <option value="superSchwarzP">Super-Schwarz P</option>
              <option value="superDiamond">Super-Diamond</option>
            </optgroup>
            <optgroup label="Hybrids &amp; Morphing Lattices">
              <option value="gyroidSchwarzHybrid">Gyroid-Schwarz Hybrid</option>
              <option value="gyroidDiamondHybrid">Gyroid-Diamond Hybrid</option>
              <option value="schwarzDiamondHybrid">Schwarz-Diamond Hybrid</option>
              <option value="gyroidVariant">Gyroid Variant</option>
              <option value="schwarzPVariant">Schwarz P Variant</option>
              <option value="diamondVariant">Diamond Variant</option>
              <option value="neoviusVariant">Neovius Variant</option>
              <option value="lidinoidVariant">Lidinoid Variant</option>
              <option value="chiralDiamond">Chiral Diamond</option>
            </optgroup>
            <optgroup label="Advanced TPMS &amp; Periodic Cells">
              <option value="schwarzCLP">Schwarz CLP</option>
              <option value="schwarzT">Schwarz T</option>
              <option value="schoenIQP">Schoen I-QP</option>
              <option value="schoenS">Schoen S</option>
              <option value="schoenM">Schoen M</option>
              <option value="schoenY">Schoen Y</option>
              <option value="schoenHT">Schoen H-T</option>
              <option value="karcherSchwarz">Karcher Schwarz</option>
              <option value="nodal4Fold">Nodal TPMS 4-Fold</option>
              <option value="nodal8Fold">Nodal TPMS 8-Fold</option>
              <option value="complementaryIWP">Complementary I-WP</option>
              <option value="schoenSPrime">Schoen S-Prime</option>
              <option value="barthSextic">Barth Sextic Periodic</option>
              <option value="kummerQuartic">Kummer Quartic Periodic</option>
              <option value="togliattiQuintic">Togliatti Quintic Periodic</option>
              <option value="clebschCubic">Clebsch Cubic Periodic</option>
              <option value="cayleyCubic">Cayley Cubic Periodic</option>
              <option value="complementaryFRD">Complementary Schoen F-RD</option>
              <option value="staircaseGyroid">Staircase Gyroid</option>
              <option value="twistedGyroid">Twisted Gyroid</option>
              <option value="schwarzHPrime">Schwarz H-Prime</option>
            </optgroup>
            <optgroup label="Periodic Layers &amp; Saddle Lattices">
              <option value="helicoid">Helicoid Infill</option>
              <option value="doubleHelicoid">Double Helicoid</option>
              <option value="triangularHoneycomb">Triangular Honeycomb</option>
              <option value="kagome3D">Kagome 3D Variant</option>
              <option value="boricAcidLayer">Boric Acid Layer</option>
              <option value="poreNetwork">Pore Network</option>
              <option value="saddle">Saddle TPMS</option>
              <option value="doubleSaddle">Double Saddle</option>
              <option value="octetTrussVariant">Octet Truss Variant</option>
              <option value="kelvinFoam">Kelvin Foam</option>
            </optgroup>
          </select>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 flex justify-between font-medium">Scale <span>{d.scale?.toFixed(0)}</span></label>
            <input type="range" min="10" max="2000" step="1" value={num(d.scale || 10.0)} onChange={(e) => updateNodeData(node.id, { scale: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 flex justify-between font-medium">Thickness <span>{d.thickness?.toFixed(2)}</span></label>
            <input type="range" min="0.01" max="1.0" step="0.01" value={num(d.thickness || 0.1)} onChange={(e) => updateNodeData(node.id, { thickness: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
          </div>
        </NodePanel>
      );
    }

    if (d.type === 'modifier') {
      return (
        <NodePanel node={node} title="Modifier" icon={<Waves className="w-4 h-4" />}>
          <select 
            value={d.modifierType}
            onChange={(e) => updateNodeData(node.id, { modifierType: e.target.value as any })}
            className="w-full bg-zinc-900 text-zinc-300 p-1.5 rounded-lg border border-zinc-800 outline-none text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
          >
            <option value="shell">Shell</option>
            <option value="offset">Offset</option>
          </select>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-500 flex justify-between font-medium">Amount <span>{d.amount?.toFixed(2)}</span></label>
            <input type="range" min="-2.0" max="2.0" step="0.05" value={num(d.amount || 0)} onChange={(e) => updateNodeData(node.id, { amount: parseFloat(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
          </div>
        </NodePanel>
      );
    }

    return (
      <NodePanel node={node} title={d.name || d.type} icon={<SlidersHorizontal className="w-4 h-4" />}>
        <div className="text-[10px] text-zinc-500 italic">Settings not available in Sidebar yet. Switch to Node Editor.</div>
      </NodePanel>
    );
  };

  return (
    <div className="w-full h-full bg-zinc-950 border border-zinc-850 overflow-y-auto p-4 custom-scrollbar text-zinc-350">
      <div className="mb-4 pb-2 border-b border-zinc-850 flex items-center gap-2 text-zinc-300">
        <SlidersHorizontal className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold uppercase tracking-wider text-[11px]">Stack Editor</h3>
      </div>
      
      {modifiers.length === 0 ? (
        <div className="text-center text-zinc-500 mt-10 text-xs">
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
