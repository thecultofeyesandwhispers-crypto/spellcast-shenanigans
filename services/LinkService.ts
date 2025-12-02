
import { 
  MessageType, 
  NetworkMessage, 
  HeartbeatMessage, 
  SpellCastMessage, 
  SpellAckMessage,
  DeviceID,
  PlayerName,
  Position,
  SpellID
} from '../types';

const CHANNEL_NAME = 'spellcast-mesh-v2';

class LinkService {
  private channel: BroadcastChannel;
  private listeners: ((msg: NetworkMessage) => void)[] = [];

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => {
      this.notifyListeners(event.data);
    };
  }

  public broadcastHeartbeat(deviceId: DeviceID, playerName: PlayerName, position: Position) {
    const msg: HeartbeatMessage = {
      type: MessageType.HEARTBEAT,
      deviceId,
      playerName,
      timestamp: Date.now(),
      payload: {
        position
      },
    };
    this.channel.postMessage(msg);
  }

  public broadcastSpell(
    deviceId: DeviceID, 
    playerName: PlayerName, 
    targetDeviceId: DeviceID, 
    spellId: SpellID, 
    incantationText: string,
    range: number
  ) {
    const msg: SpellCastMessage = {
      type: MessageType.SPELL_CAST,
      deviceId,
      playerName,
      timestamp: Date.now(),
      payload: {
        castId: crypto.randomUUID(),
        spellId,
        targetDeviceId,
        incantationText,
        sourceRangeMeters: range
      },
    };
    this.channel.postMessage(msg);
    this.notifyListeners(msg); // Local echo
  }

  public broadcastAck(
    deviceId: DeviceID,
    playerName: PlayerName,
    castId: string,
    success: boolean,
    resultMessage: string
  ) {
    const msg: SpellAckMessage = {
      type: MessageType.SPELL_ACK,
      deviceId,
      playerName,
      timestamp: Date.now(),
      payload: {
        castId,
        success,
        resultMessage
      }
    };
    this.channel.postMessage(msg);
    // No local echo needed usually, but good for logs
    this.notifyListeners(msg); 
  }

  public subscribe(callback: (msg: NetworkMessage) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(msg: NetworkMessage) {
    this.listeners.forEach((l) => l(msg));
  }
}

export const linkService = new LinkService();
