"use client";

import { SceneViewer } from '@/components/SceneViewer';
import { UIController } from '@/components/UIController';
import { NodeEditor } from '@/components/NodeEditor';

export default function Home() {
  return (
    <main className="w-full h-screen overflow-hidden relative bg-zinc-950 flex flex-col">
      <UIController />
      
      <div className="w-full h-full pt-20 pb-2 px-2 flex gap-2">
        {/* Left Side: 3D Canvas */}
        <div className="flex-1 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative">
          <SceneViewer />
        </div>
        
        {/* Right Side: Node Editor */}
        <div className="flex-1 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative">
          <NodeEditor />
        </div>
      </div>
    </main>
  );
}
