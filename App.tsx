
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LogEntry, 
  MessageType, 
  PlayerNode, 
  Position, 
  SPELL_RANGE_METERS, 
  REQUIRED_REPETITIONS,
  INCANTATION_WINDOW_MS,
  DeviceID,
  SpellID
} from './types';
import { linkService } from './services/LinkService';
import { Radar } from './components/Radar';
import { Terminal } from './components/Terminal';
import { Mic, MicOff, RefreshCw, Volume2, Wifi, Zap } from 'lucide-react';

// --- Types for Speech Recognition ---
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: any) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

// --- Utilities ---
const getDeviceId = (): DeviceID => {
  const key = 'spellcast_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};

const getRandomName = () => {
  const names = ['Riven', 'Hero', 'Zed', 'Lux', 'Jinx', 'Vi', 'Ekko'];
  return names[Math.floor(Math.random() * names.length)] + '-' + Math.floor(Math.random() * 100);
};

// --- Main Component ---
export default function App() {
  // State: Identity
  const [deviceId] = useState(getDeviceId());
  const [name, setName] = useState(getRandomName());
  
  // State: Physics
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [peers, setPeers] = useState<Record<string, PlayerNode>>({});

  // State: System
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognizedPhrases, setRecognizedPhrases] = useState<{text: string, time: number}[]>([]);
  
  // Debug State
  const [activeCharges, setActiveCharges] = useState<Record<string, number>>({});

  // Refs for non-react loop logic
  const peersRef = useRef<Record<string, PlayerNode>>({});
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const positionRef = useRef(position);
  const isListeningRef = useRef(isListening); 
  const restartTimeoutRef = useRef<number | null>(null);

  // Sync ref
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-50), { id: crypto.randomUUID(), timestamp: Date.now(), message, type }]);
  }, []);

  // --- Network Setup ---
  useEffect(() => {
    addLog(`System initialized. Device ID: ${deviceId.substring(0,8)}...`, 'system');

    // Subscribe to mesh events
    const unsubscribe = linkService.subscribe((msg) => {
      // HANDLE HEARTBEAT
      if (msg.type === MessageType.HEARTBEAT) {
        if (msg.deviceId === deviceId) return;

        const peer: PlayerNode = {
          deviceId: msg.deviceId,
          name: msg.playerName,
          position: msg.payload.position,
          lastSeen: Date.now(),
        };
        peersRef.current = { ...peersRef.current, [msg.deviceId]: peer };
        setPeers({ ...peersRef.current });
      } 
      
      // HANDLE SPELL CAST
      else if (msg.type === MessageType.SPELL_CAST) {
        if (msg.deviceId === deviceId) return; // Ignore own casts via network (echo handled locally if needed)

        const { spellId, targetDeviceId } = msg.payload;
        addLog(`${msg.playerName} cast [${spellId}]`, 'combat');

        // AM I THE TARGET?
        if (targetDeviceId === deviceId) {
           handleEffectReceived(msg.payload.castId, spellId, msg.playerName);
        }
      }

      // HANDLE ACK
      else if (msg.type === MessageType.SPELL_ACK) {
        if (msg.payload.success) {
          addLog(`ACK from ${msg.playerName}: ${msg.payload.resultMessage}`, 'system');
        }
      }
    });

    // Start Heartbeat Loop
    const heartbeatInterval = setInterval(() => {
      linkService.broadcastHeartbeat(deviceId, name, positionRef.current);
      
      // Prune old peers (> 5s offline)
      const now = Date.now();
      let changed = false;
      Object.entries(peersRef.current).forEach(([id, peer]: [string, PlayerNode]) => {
        if (now - peer.lastSeen > 5000) {
          delete peersRef.current[id];
          changed = true;
        }
      });
      if (changed) setPeers({ ...peersRef.current });

    }, 500); 

    return () => {
      unsubscribe();
      clearInterval(heartbeatInterval);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, [deviceId, name, addLog]); 

  // --- Spell Logic ---

  const handleEffectReceived = (castId: string, spell: string, casterName: string) => {
    // Visual Shake
    document.body.classList.add('animate-pulse', 'bg-red-900/20');
    setTimeout(() => document.body.classList.remove('animate-pulse', 'bg-red-900/20'), 500);

    // TTS
    const utterance = new SpeechSynthesisUtterance(`You are shoved by ${casterName}`);
    utterance.rate = 1.2;
    window.speechSynthesis.speak(utterance);

    addLog(`*** HIT BY ${spell.toUpperCase()} ***`, 'error');
    if (navigator.vibrate) navigator.vibrate([200, 50, 200]);

    // Send ACK
    linkService.broadcastAck(
      deviceId,
      name,
      castId,
      true,
      "Target impacted successfully."
    );
  };

  const attemptSpellCast = (targetName: string, spell: SpellID) => {
    // 1. Resolve Target Name -> Device ID
    const players = Object.values(peersRef.current) as PlayerNode[];
    // Find closest match by name
    const targetEntry = players.find((p) => p.name.toLowerCase() === targetName.toLowerCase());
    
    if (!targetEntry) {
      addLog(`Target '${targetName}' not found or out of signal range.`, 'error');
      return;
    }

    // 2. Distance Check
    const dx = targetEntry.position.x - positionRef.current.x;
    const dy = targetEntry.position.y - positionRef.current.y;
    const distance = Math.sqrt(dx*dx + dy*dy);

    if (distance > SPELL_RANGE_METERS) {
        addLog(`Target '${targetName}' is too far (${distance.toFixed(1)}m > ${SPELL_RANGE_METERS}m).`, 'error');
        return;
    }

    // 3. Success Broadcast
    linkService.broadcastSpell(
      deviceId,
      name,
      targetEntry.deviceId,
      spell,
      `${targetName}, my power shoves thee`,
      distance
    );
    
    addLog(`Casting [${spell}] on ${targetEntry.name}...`, 'combat');
    setRecognizedPhrases([]); 
  };

  const processPhraseBuffer = useCallback(() => {
    const regex = /\b(?<target>[\w-]+)[,.]?\s+my power shoves thee/gi;
    
    const now = Date.now();
    const activePhrases = recognizedPhrases.filter(p => now - p.time < INCANTATION_WINDOW_MS);
    
    const counts: Record<string, number> = {};
    
    activePhrases.forEach(phrase => {
      const matches = phrase.text.matchAll(regex);
      for (const match of matches) {
          if (match.groups?.target) {
              const target = match.groups.target.trim();
              counts[target] = (counts[target] || 0) + 1;
          }
      }
    });
    
    setActiveCharges(counts);

    Object.entries(counts).forEach(([target, count]) => {
      if (count >= REQUIRED_REPETITIONS) {
        attemptSpellCast(target, 'shove');
      }
    });
    
  }, [recognizedPhrases, name, deviceId]); // added deps

  useEffect(() => {
    processPhraseBuffer();
  }, [recognizedPhrases, processPhraseBuffer]);


  // --- Speech Recognition ---
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech Recognition.");
      return;
    }

    try {
        if (recognitionRef.current) {
            recognitionRef.current.abort(); 
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            addLog("Voice Uplink Established.", 'system');
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const phrase = event.results[i][0].transcript.trim();
                    setTranscript(phrase);
                    addLog(`Recognized: "${phrase}"`);
                    setRecognizedPhrases(prev => [...prev, { text: phrase, time: Date.now() }]);
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (interim) setTranscript(interim + "...");
        };

        recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech') {
                addLog(`Voice Error: ${event.error}`, 'error');
            }
        };

        recognition.onend = () => {
            if (isListeningRef.current) {
                restartTimeoutRef.current = window.setTimeout(() => {
                    if (isListeningRef.current) {
                        addLog("Restarting Voice Service...", 'system');
                        startListening();
                    }
                }, 1000);
            } else {
                addLog("Voice Uplink Terminated.", 'system');
                setIsListening(false);
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
    } catch (e) {
        addLog(`Could not start mic: ${e}`, 'error');
        setIsListening(false);
    }
  }, [addLog]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
  }, []);
  
  const toggleListening = () => {
      if (isListening) {
          stopListening();
      } else {
          startListening();
      }
  };
  
  // --- Manual Override ---
  const [manualInput, setManualInput] = useState("");
  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualInput) return;
      setRecognizedPhrases(prev => [...prev, { text: manualInput, time: Date.now() }]);
      addLog(`Manual Input: "${manualInput}"`);
      setManualInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-zinc-950 border-x border-zinc-800 shadow-2xl relative overflow-hidden">
      
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800 z-10">
        <div>
          <h1 className="text-cyan-400 font-bold tracking-tighter text-lg flex items-center gap-2">
            <Wifi className="w-4 h-4 animate-pulse" /> UPLINK_NODE
          </h1>
          <div className="text-[10px] text-zinc-500 font-mono" title={deviceId}>{deviceId.substring(0,12)}...</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-200 font-bold">{name}</div>
          <div className="text-[10px] text-emerald-500">ONLINE</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-6 relative">
        
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent pointer-events-none" />

        {/* Radar */}
        <div className="z-0">
          <Radar 
            self={{ deviceId, name, position, lastSeen: Date.now(), isSelf: true }}
            peers={Object.values(peers)}
            onPositionChange={setPosition}
          />
        </div>

        {/* HUD Info */}
        <div className="w-full grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-zinc-900/50 p-2 border border-zinc-800 rounded">
                <span className="text-zinc-500 block">COORDS</span>
                <span className="text-cyan-400">X:{position.x.toFixed(1)} Y:{position.y.toFixed(1)}</span>
            </div>
            <div className="bg-zinc-900/50 p-2 border border-zinc-800 rounded">
                <span className="text-zinc-500 block">NEIGHBORS</span>
                <span className="text-emerald-400">{Object.keys(peers).length} ACTIVE</span>
            </div>
        </div>
        
        {/* Spell Charge Indicator */}
        {Object.keys(activeCharges).length > 0 && (
             <div className="w-full bg-zinc-900/80 p-2 border border-yellow-900/50 rounded text-xs font-mono">
                <div className="text-yellow-500 mb-1 flex items-center gap-1"><Zap className="w-3 h-3"/> SPELL CHARGE</div>
                {Object.entries(activeCharges).map(([target, count]: [string, number]) => (
                    <div key={target} className="flex justify-between items-center text-zinc-300">
                        <span>{target}</span>
                        <div className="flex gap-0.5">
                            {[1,2,3].map(i => (
                                <div key={i} className={`w-3 h-1 rounded-sm ${count >= i ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-zinc-700'}`} />
                            ))}
                        </div>
                    </div>
                ))}
             </div>
        )}

        {/* Voice Controls */}
        <div className="w-full flex flex-col gap-2 z-10">
           
           <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 min-h-[60px] flex items-center justify-center text-center">
              {transcript ? (
                <p className="text-zinc-300 italic">"{transcript}"</p>
              ) : (
                <p className="text-zinc-600 text-xs">Awaiting incantation...</p>
              )}
           </div>

           <div className="flex gap-2">
                <button 
                    onClick={toggleListening}
                    className={`flex-1 py-4 rounded font-bold flex items-center justify-center gap-2 transition-all ${
                        isListening 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                    {isListening ? <><Mic className="w-5 h-5 animate-pulse" /> LISTENING</> : <><MicOff className="w-5 h-5" /> ENGAGE MIC</>}
                </button>
           </div>
           
           {/* Manual Fallback */}
           <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input 
                    type="text" 
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Debug: Type spell here..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                />
                <button type="submit" className="bg-zinc-800 p-2 rounded text-zinc-400 hover:text-white">
                    <Volume2 className="w-4 h-4" />
                </button>
           </form>
           <p className="text-[10px] text-zinc-600 text-center">
               Say: "<span className="text-zinc-500 font-bold">Target</span>, my power shoves thee" x3
           </p>
        </div>

      </main>

      {/* Footer Log */}
      <Terminal logs={logs} />
      
      {/* Identity Reset */}
      <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <button onClick={() => window.location.reload()} className="p-1 bg-black text-white rounded-full">
            <RefreshCw className="w-3 h-3"/>
          </button>
      </div>

    </div>
  );
}
