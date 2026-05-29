"use client";

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useGpuStore } from '@/store/useGpuStore';
import { Sun, Grid, Eye, ChevronDown, ChevronUp, Layers, Sliders, Lightbulb } from 'lucide-react';

interface ViewportControlsProps {
  type: 'cpu' | 'gpu';
}

export function ViewportControls({ type }: ViewportControlsProps) {
  const cpuShowGround = useStore((s) => s.showGround);
  const gpuShowGround = useGpuStore((s) => s.showGround);
  const showGround = type === 'cpu' ? cpuShowGround : gpuShowGround;

  const cpuShowShadows = useStore((s) => s.showShadows);
  const gpuShowShadows = useGpuStore((s) => s.showShadows);
  const showShadows = type === 'cpu' ? cpuShowShadows : gpuShowShadows;

  const cpuShowAO = useStore((s) => s.showAO);
  const gpuShowAO = useGpuStore((s) => s.showAO);
  const showAO = type === 'cpu' ? cpuShowAO : gpuShowAO;

  const cpuShowWireframe = useStore((s) => s.showWireframe);
  const gpuShowWireframe = useGpuStore((s) => s.showWireframe);
  const showWireframe = type === 'cpu' ? cpuShowWireframe : gpuShowWireframe;

  const cpuLightDir = useStore((s) => s.lightDir);
  const gpuLightDir = useGpuStore((s) => s.lightDir);
  const lightDir = type === 'cpu' ? cpuLightDir : gpuLightDir;

  const cpuLightIntensity = useStore((s) => s.lightIntensity);
  const gpuLightIntensity = useGpuStore((s) => s.lightIntensity);
  const lightIntensity = type === 'cpu' ? cpuLightIntensity : gpuLightIntensity;

  const cpuAmbientIntensity = useStore((s) => s.ambientIntensity);
  const gpuAmbientIntensity = useGpuStore((s) => s.ambientIntensity);
  const ambientIntensity = type === 'cpu' ? cpuAmbientIntensity : gpuAmbientIntensity;

  const cpuSetSettings = useStore((s) => s.setVisualizationSettings);
  const gpuSetSettings = useGpuStore((s) => s.setVisualizationSettings);
  const setVisualizationSettings = type === 'cpu' ? cpuSetSettings : gpuSetSettings;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'visuals' | 'lighting'>('visuals');

  // Compute angle in degrees from lightDir [x, y, z] (orbit in XZ plane)
  const [lx, ly, lz] = lightDir;
  const rad = Math.atan2(lz, lx);
  let angleDeg = Math.round(rad * 180 / Math.PI);
  if (angleDeg < 0) angleDeg += 360;

  const handleAngleChange = (newAngle: number) => {
    const rads = newAngle * Math.PI / 180;
    // Keep radius constant (approx 12)
    const radius = Math.sqrt(lx * lx + lz * lz) || 11.18;
    const x = radius * Math.cos(rads);
    const z = radius * Math.sin(rads);
    setVisualizationSettings({ lightDir: [x, ly, z] });
  };

  const handleHeightChange = (newHeight: number) => {
    setVisualizationSettings({ lightDir: [lx, newHeight, lz] });
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/90 hover:bg-zinc-800/95 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 text-zinc-100 rounded-xl shadow-xl transition-all duration-200 text-xs font-semibold"
      >
        <Sliders className="w-4 h-4 text-amber-500" />
        Viewport Settings
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 font-bold" /> : <ChevronUp className="w-3.5 h-3.5 font-bold" />}
      </button>

      {/* Main Panel */}
      {isOpen && (
        <div className="mt-2.5 w-72 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl p-4 text-zinc-200 transition-all duration-300">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800/80 pb-2 mb-3">
            <button
              onClick={() => setActiveTab('visuals')}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-all ${
                activeTab === 'visuals'
                  ? 'bg-zinc-900 border border-zinc-800 text-amber-500 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Environment
            </button>
            <button
              onClick={() => setActiveTab('lighting')}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-all ${
                activeTab === 'lighting'
                  ? 'bg-zinc-900 border border-zinc-800 text-amber-500 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Lighting
            </button>
          </div>

          {/* Environment Tab Content */}
          {activeTab === 'visuals' && (
            <div className="space-y-3.5">
              {/* Ground Plane */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-900/60 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <Grid className="w-4 h-4 text-zinc-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-200">Ground Plane</span>
                    <span className="text-[10px] text-zinc-500">Render base floor grid</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showGround}
                  onChange={(e) => setVisualizationSettings({ showGround: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
                />
              </label>

              {/* Shadows */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-900/60 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px] bg-zinc-850 text-zinc-400 border border-zinc-750 rounded-sm">S</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-200">Shadows</span>
                    <span className="text-[10px] text-zinc-500">Cast directional shadows</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showShadows}
                  onChange={(e) => setVisualizationSettings({ showShadows: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
                />
              </label>

              {/* Ambient Occlusion */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-900/60 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px] bg-zinc-850 text-zinc-400 border border-zinc-750 rounded-sm">AO</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-200">Ambient Occlusion</span>
                    <span className="text-[10px] text-zinc-500">Contact shadow crevices</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showAO}
                  onChange={(e) => setVisualizationSettings({ showAO: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
                />
              </label>

              {/* Wireframe Overlay */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:bg-zinc-900/60 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-200">Wireframe Overlay</span>
                    <span className="text-[10px] text-zinc-500">Draw wire mesh on solid</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showWireframe}
                  onChange={(e) => setVisualizationSettings({ showWireframe: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-4 h-4 accent-amber-500"
                />
              </label>
            </div>
          )}

          {/* Lighting Tab Content */}
          {activeTab === 'lighting' && (
            <div className="space-y-4">
              {/* Direct Intensity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Light Intensity
                  </span>
                  <span className="text-[10px] text-zinc-400">{lightIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={lightIntensity}
                  onChange={(e) => setVisualizationSettings({ lightIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Ambient Intensity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Ambient Light
                  </span>
                  <span className="text-[10px] text-zinc-400">{ambientIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={ambientIntensity}
                  onChange={(e) => setVisualizationSettings({ ambientIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Light Angle (Orbit) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Light Orbit Angle</span>
                  <span className="text-[10px] text-zinc-400">{angleDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="2"
                  value={angleDeg}
                  onChange={(e) => handleAngleChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Light Elevation / Height */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>Light Height</span>
                  <span className="text-[10px] text-zinc-400">{ly.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={ly}
                  onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
