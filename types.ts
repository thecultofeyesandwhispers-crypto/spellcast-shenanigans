
export type DeviceID = string; // UUID
export type PlayerName = string;
export type SpellID = 'shove' | 'pull' | 'ignite';

export interface Position {
  x: number;
  y: number;
}

// Local representation of a peer
export interface PlayerNode {
  deviceId: DeviceID;
  name: PlayerName;
  position: Position;
  lastSeen: number;
  isSelf?: boolean;
}

export enum MessageType {
  HEARTBEAT = 'HEARTBEAT',
  SPELL_CAST = 'SPELL_CAST',
  SPELL_ACK = 'SPELL_ACK',
}

// --- Protocol Messages ---

export interface BaseMessage {
  deviceId: DeviceID;
  playerName: PlayerName;
  timestamp: number;
}

export interface HeartbeatMessage extends BaseMessage {
  type: MessageType.HEARTBEAT;
  payload: {
    position: Position;
    // Future: batteryLevel, status, etc.
  };
}

export interface SpellCastMessage extends BaseMessage {
  type: MessageType.SPELL_CAST;
  payload: {
    castId: string; // UUID for specific event
    spellId: SpellID;
    targetDeviceId: DeviceID;
    incantationText: string;
    sourceRangeMeters: number;
  };
}

export interface SpellAckMessage extends BaseMessage {
  type: MessageType.SPELL_ACK;
  payload: {
    castId: string; // Reference to the cast
    success: boolean;
    resultMessage: string;
  };
}

export type NetworkMessage = HeartbeatMessage | SpellCastMessage | SpellAckMessage;

// --- Application Constants ---

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'combat' | 'system' | 'error';
}

export const SPELL_RANGE_METERS = 6.1;
export const INCANTATION_WINDOW_MS = 5000;
export const REQUIRED_REPETITIONS = 3;
