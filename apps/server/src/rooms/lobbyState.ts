// LobbyRoom schema (docs/NETWORK.md § Lobby state). Clients read it as `LobbyView` (protocol.ts).
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { DEFAULT_SETTINGS, type GameMode, type MachineId, type MapId, type MatchSettings, type TeamId, type WindSetting } from '@lobbers/shared';

export class LobbyPlayerSchema extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') title = '';
  @type('uint16') level = 1;
  @type('string') team: TeamId = 'red';
  @type('uint8') slot = 0;
  @type('string') machine: MachineId = 'thumper';
  @type('boolean') ready = false;
  @type('boolean') connected = true;
  @type('float64') reconnectUntil = 0;
  @type('boolean') isHost = false;
  @type('uint16') ping = 0;
  @type('float64') joinedAt = 0;
}

export class SettingsSchema extends Schema {
  @type('string') mode: GameMode = DEFAULT_SETTINGS.mode;
  @type('string') mapId: MapId = DEFAULT_SETTINGS.mapId;
  @type('uint8') turnSeconds: MatchSettings['turnSeconds'] = DEFAULT_SETTINGS.turnSeconds;
  @type('string') wind: WindSetting = DEFAULT_SETTINGS.wind;
  @type('float32') friendlyFire: MatchSettings['friendlyFire'] = DEFAULT_SETTINGS.friendlyFire;
  @type('boolean') itemsEnabled = DEFAULT_SETTINGS.itemsEnabled;
  @type('uint8') bestOf: MatchSettings['bestOf'] = DEFAULT_SETTINGS.bestOf;
  @type('boolean') isPrivate = DEFAULT_SETTINGS.isPrivate;

  toSettings(): MatchSettings {
    return { mode: this.mode, mapId: this.mapId, turnSeconds: this.turnSeconds, wind: this.wind, friendlyFire: this.friendlyFire, itemsEnabled: this.itemsEnabled, bestOf: this.bestOf, isPrivate: this.isPrivate };
  }
}

export class ChatLineSchema extends Schema {
  @type('uint32') id = 0;
  @type('string') playerId = '';
  @type('string') name = '';
  @type('string') team: TeamId | 'system' = 'system';
  @type('string') text = '';
  @type('float64') at = 0;
}

export class LobbyState extends Schema {
  @type('string') code = '';
  @type('string') name = '';
  @type('boolean') isPrivate = true;
  @type('boolean') ranked = false;
  @type('string') hostId = '';
  @type('string') phase: 'open' | 'starting' | 'inMatch' = 'open';
  @type('float64') countdownEndsAt = 0;
  @type('string') matchId = '';
  @type(SettingsSchema) settings = new SettingsSchema();
  @type({ map: LobbyPlayerSchema }) players = new MapSchema<LobbyPlayerSchema>();
  @type([ChatLineSchema]) chat = new ArraySchema<ChatLineSchema>();
}
