export interface Position {
  x: number;
  y: number;
}

export interface PlayerNode {
  id: string;
  name: string;
  position: Position;
  lastSeen: number;
  isSelf?: boolean;
}

export enum NetworkEventType {
  HEARTBEAT = 'HEARTBEAT',
  SPELL_CAST = 'SPELL_CAST',
}

export interface NetworkMessage {
  type: NetworkEventType;
  senderId: string;
  payload: any;
  timestamp: number;
}

export interface HeartbeatPayload {
  name: string;
  position: Position;
}

export interface SpellCastPayload {
  casterName: string;
  targetName: string;
  spell: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'combat' | 'system' | 'error';
}

export const SPELL_RANGE_METERS = 6.1;
export const INCANTATION_WINDOW_MS = 5000;
export const REQUIRED_REPETITIONS = 3;