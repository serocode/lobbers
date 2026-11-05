// Server-wide room settings from the environment (set once at boot; rooms read them on create).
import { CONNECTION_RULES } from '@lobbers/shared';

export interface RoomSettings { reconnectWindowSec: number }
let settings: RoomSettings = { reconnectWindowSec: CONNECTION_RULES.reconnectWindowSec };

export const configureRooms = (s: RoomSettings): void => { settings = s; };
export const roomSettings = (): RoomSettings => settings;
