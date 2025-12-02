import React, { useRef, useEffect, useState } from 'react';
import { PlayerNode, SPELL_RANGE_METERS } from '../types';

interface RadarProps {
  self: PlayerNode;
  peers: PlayerNode[];
  onPositionChange: (newPos: { x: number; y: number }) => void;
}

const SCALE = 20; // pixels per meter
const VIEW_SIZE = 300; // px
const CENTER = VIEW_SIZE / 2;

export const Radar: React.FC<RadarProps> = ({ self, peers, onPositionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates (meters)
    // Center of screen is (0,0) relative to self?
    // No, let's make the center of the screen (0,0) in world space for simplicity in this demo,
    // so players move around a fixed origin.
    
    // Actually, usually in a game, Self is center. But for this simulation, 
    // to allow testing distance, let's say the Radar represents a 15x15m room.
    // (0,0) is the center of the room.
    
    const worldX = (clickX - CENTER) / SCALE;
    const worldY = (clickY - CENTER) / SCALE;

    onPositionChange({ x: worldX, y: worldY });
  };

  // Render
  return (
    <div className="flex flex-col items-center select-none">
      <div className="mb-2 text-xs text-zinc-500 uppercase tracking-widest">UWB Spatial Grid</div>
      <div 
        ref={containerRef}
        className="relative bg-zinc-900 border border-zinc-700 rounded-full overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-crosshair touch-none"
        style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-500" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[122px] h-[122px] border border-cyan-500 rounded-full" /> {/* ~6.1m radius */}
        </div>

        {/* Range Ring Indicator (6.1m) around SELF */}
        <div 
            className="absolute border border-dashed border-emerald-500/30 rounded-full pointer-events-none transition-all duration-75"
            style={{
                width: SPELL_RANGE_METERS * 2 * SCALE,
                height: SPELL_RANGE_METERS * 2 * SCALE,
                left: CENTER + self.position.x * SCALE - (SPELL_RANGE_METERS * SCALE),
                top: CENTER + self.position.y * SCALE - (SPELL_RANGE_METERS * SCALE),
            }}
        />

        {/* Peers */}
        {peers.map(peer => {
            const isTargetable = Math.sqrt(
                Math.pow(peer.position.x - self.position.x, 2) + 
                Math.pow(peer.position.y - self.position.y, 2)
            ) <= SPELL_RANGE_METERS;

            return (
                <div 
                    key={peer.id}
                    className={`absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none ${isTargetable ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-zinc-500'}`}
                    style={{
                        left: CENTER + peer.position.x * SCALE,
                        top: CENTER + peer.position.y * SCALE,
                    }}
                >
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-zinc-400 font-bold">
                        {peer.name}
                    </div>
                </div>
            );
        })}

        {/* Self */}
        <div 
            className="absolute w-4 h-4 bg-cyan-400 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#22d3ee] pointer-events-none transition-all duration-75"
            style={{
                left: CENTER + self.position.x * SCALE,
                top: CENTER + self.position.y * SCALE,
            }}
        >
             <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-cyan-400 font-bold">
                YOU
            </div>
        </div>

      </div>
      <div className="mt-2 text-[10px] text-zinc-600">
        Drag to move • Inner Circle: 6.1m Range
      </div>
    </div>
  );
};