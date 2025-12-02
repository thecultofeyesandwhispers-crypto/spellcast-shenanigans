import { NetworkEventType, NetworkMessage, HeartbeatPayload, SpellCastPayload } from '../types';

const CHANNEL_NAME = 'spellcast-mesh-v1';

class LinkService {
  private channel: BroadcastChannel;
  private listeners: ((msg: NetworkMessage) => void)[] = [];

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => {
      this.notifyListeners(event.data);
    };
  }

  public broadcastHeartbeat(senderId: string, payload: HeartbeatPayload) {
    const msg: NetworkMessage = {
      type: NetworkEventType.HEARTBEAT,
      senderId,
      payload,
      timestamp: Date.now(),
    };
    this.channel.postMessage(msg);
  }

  public broadcastSpell(senderId: string, payload: SpellCastPayload) {
    const msg: NetworkMessage = {
      type: NetworkEventType.SPELL_CAST,
      senderId,
      payload,
      timestamp: Date.now(),
    };
    this.channel.postMessage(msg);
    // Also notify local listeners so we see our own casts
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