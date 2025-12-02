import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-48 bg-zinc-950 border-t border-zinc-800 p-4 font-mono text-sm relative">
      <div className="absolute top-0 right-0 px-2 py-1 bg-zinc-900 text-[10px] text-zinc-500 uppercase">Sys.Log</div>
      <div className="overflow-y-auto no-scrollbar flex-1 space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-zinc-600 text-xs shrink-0">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
            <span className={`break-words ${
              log.type === 'combat' ? 'text-red-400' :
              log.type === 'system' ? 'text-cyan-600' :
              log.type === 'error' ? 'text-yellow-500' :
              'text-zinc-400'
            }`}>
              {log.type === 'combat' && '⚡ '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};