
# Spellcast Mesh Protocol v2

This document defines the messaging schema used by Spellcast Player Nodes to communicate over the local mesh network (simulated via BroadcastChannel or UDP).

## Identity Model

*   **Device ID (`deviceId`)**: A persistent UUIDv4 string generated on first launch and stored in local storage. Identifies the physical hardware.
*   **Player Name (`playerName`)**: A mutable display string (e.g., "Riven-55").

## Message Structure

All messages follow this base envelope:

```typescript
interface BaseMessage {
  deviceId: string;       // Sender UUID
  playerName: string;     // Sender Display Name
  timestamp: number;      // Epoch ms
  type: string;           // Message Discriminator
  payload: any;           // Specific Data
}
```

### 1. Heartbeat (`HEARTBEAT`)
Broadcast at 2Hz (500ms). Used for discovery and positioning.

```json
{
  "type": "HEARTBEAT",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "playerName": "Riven",
  "timestamp": 1700000000000,
  "payload": {
    "position": { "x": 1.5, "y": -2.0 }
  }
}
```

### 2. Spell Cast (`SPELL_CAST`)
Sent when a player successfully completes an incantation targeting another valid node.

```json
{
  "type": "SPELL_CAST",
  "deviceId": "550e8400-...",
  "playerName": "Riven",
  "timestamp": 1700000000000,
  "payload": {
    "castId": "d70c8f12-...",      // Unique ID for this cast event
    "spellId": "shove",             // Enum: 'shove', 'pull', 'ignite'
    "targetDeviceId": "a82b9c...",  // UUID of intended victim
    "incantationText": "Hero, my power shoves thee",
    "sourceRangeMeters": 4.5        // Distance calculated by caster
  }
}
```

### 3. Spell Acknowledgment (`SPELL_ACK`)
Sent by the victim upon receiving a spell effect.

```json
{
  "type": "SPELL_ACK",
  "deviceId": "a82b9c...",        // Victim ID
  "playerName": "Hero",
  "timestamp": 1700000000500,
  "payload": {
    "castId": "d70c8f12-...",     // Matches the CAST message
    "success": true,
    "resultMessage": "Target impacted successfully."
  }
}
```
