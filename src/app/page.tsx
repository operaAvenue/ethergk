"use client";

import { SceneViewer } from '@/components/SceneViewer';
import { UIController } from '@/components/UIController';
import { NodeEditor } from '@/components/NodeEditor';
import { SidebarEditor } from '@/components/SidebarEditor';
import { useStore } from '@/store/useStore';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const { layoutSplitRatio, layoutIsVertical, layoutIsSwapped, setLayoutSplitRatio, uiMode } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      let ratio = 50;
      if (layoutIsVertical) {
        ratio = ((clientX - rect.left) / rect.width) * 100;
      } else {
        ratio = ((clientY - rect.top) / rect.height) * 100;
      }

      // Clamp between 10% and 90%
      ratio = Math.max(10, Math.min(90, ratio));
      setLayoutSplitRatio(ratio);
    };

    const handleUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [layoutIsVertical, setLayoutSplitRatio]);

  const handleDragStart = () => {
    isDragging.current = true;
    document.body.style.cursor = layoutIsVertical ? 'col-resize' : 'row-resize';
  };

  const panels = [
    <div key="3d" className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative">
      <SceneViewer />
    </div>,
    <div key="node" className="w-full h-full rounded-xl overflow-hidden shadow-2xl relative">
      {uiMode === 'sidebar' ? <SidebarEditor /> : <NodeEditor />}
    </div>
  ];

  if (layoutIsSwapped) {
    panels.reverse();
  }

  return (
    <main className="w-full h-screen overflow-hidden relative bg-zinc-950 flex flex-col">
      <UIController />
      
      <div 
        ref={containerRef}
        className={`w-full h-full pt-20 pb-2 px-2 flex ${layoutIsVertical ? 'flex-row' : 'flex-col'} gap-2 select-none`}
      >
        <div style={{ flexBasis: `${layoutSplitRatio}%`, flexGrow: 0, flexShrink: 0 }} className="h-full">
          {panels[0]}
        </div>
        
        <div 
          className={`flex items-center justify-center bg-zinc-900 rounded-full hover:bg-fuchsia-500/50 transition-colors cursor-${layoutIsVertical ? 'col' : 'row'}-resize`}
          style={{ 
            width: layoutIsVertical ? '6px' : '100%', 
            height: layoutIsVertical ? '100%' : '6px',
            margin: layoutIsVertical ? '0 -1px' : '-1px 0',
            zIndex: 10
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        />
        
        <div style={{ flexBasis: `calc(${100 - layoutSplitRatio}% - 6px)`, flexGrow: 1, flexShrink: 1 }} className="h-full">
          {panels[1]}
        </div>
      </div>
    </main>
  );
}
