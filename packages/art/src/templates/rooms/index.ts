// All 50 room templates, in catalog order (the order is each room's plan seed: keep it).
import { LIBRARY_ROOMS } from './library.ts';
import { MACHINE_ROOMS } from './machine.ts';
import { MEETING_ROOMS } from './meeting.ts';
import type { RoomTemplate } from './template.ts';
import { WORKSHOP_ROOMS } from './workshop.ts';

export type { RoomTemplate } from './template.ts';
export const ROOM_TEMPLATES: readonly RoomTemplate[] = [...LIBRARY_ROOMS, ...WORKSHOP_ROOMS, ...MACHINE_ROOMS, ...MEETING_ROOMS];
const BY_ID = new Map(ROOM_TEMPLATES.map((r, i) => [r.id, { r, i }]));
/** A template and its seed (its place in the catalog), or undefined. */
export const roomTemplate = (id: string): { r: RoomTemplate; i: number } | undefined => BY_ID.get(id);
