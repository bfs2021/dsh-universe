// The 50 room templates as the model sees them (id, tags, floor): the catalog `chooseRoom` picks from.
// Their furniture is in templates/rooms.
import type { RoomInfo } from '@dsh-universe/model';
import { ROOM_TEMPLATES } from './templates/rooms/index.ts';

export const ROOMS: readonly RoomInfo[] = ROOM_TEMPLATES.map((r) => ({ id: r.id, tags: r.tags, floors: r.floors }));
