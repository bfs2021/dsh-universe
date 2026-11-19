// Room templates for the meeting floor: subagents (10 rooms).
// Each is a 12×12 room: a plan type, a back wall, a centrepiece, a kind of workstation, a side room, a corner and
// three floor colours. Tags are the theme vocabulary. All rights reserved.
import { T, type RoomTemplate } from './template.ts';

export const MEETING_ROOMS: readonly RoomTemplate[] = [
  T('warroom', ['ops', 'security'], 'meeting', 3, 'mapw', 'table', 'console', 'glass', 'pantry', '#DDF0F8', '#2E9E48', '#8BD93E'),
  T('standup', ['code', 'product'], 'meeting', 1, 'queue', 'boardk', 'desk', 'glass', 'pantry', '#E6F7D6', '#19B8A0', '#BFF1EE'),
  T('boardroom', ['finance', 'legal', 'admin'], 'meeting', 3, 'charts', 'longtable', 'carrel', 'glass', 'lounge', '#F4F1E8', '#5A4636', '#C9925A'),
  T('salesfloor', ['sales'], 'meeting', 0, 'video', 'gong', 'desk', 'glass', 'pantry', '#FFF6CF', '#E5433D', '#FF8A7A'),
  T('briefing', ['media', 'marketing'], 'meeting', 4, 'tvwall', 'podium', 'desk', 'booth', 'pantry', '#E9DDF5', '#2F6BDE', '#7FA8F5'),
  T('helpdesk', ['support'], 'meeting', 4, 'queue', 'counter', 'desk', 'glass', 'lounge', '#E6F7D6', '#19B8A0', '#BFF1EE'),
  T('hiring', ['hr'], 'meeting', 1, 'queue', 'roundt', 'cafe', 'glass', 'lounge', '#FFE9F3', '#FF4FA3', '#FFE9F3'),
  T('labmeet', ['research'], 'meeting', 3, 'chem', 'posters', 'cafe', 'glass', 'pantry', '#E6F7D6', '#2E9E48', '#8BD93E'),
  T('planning', ['design', 'product'], 'meeting', 1, 'mood', 'sandtable', 'draft', 'store', 'pantry', '#FFF6CF', '#FF8A2B', '#FFC928'),
  T('audit', ['finance', 'legal', 'data'], 'meeting', 0, 'books', 'evidence', 'carrel', 'glass', 'lounge', '#F4F1E8', '#59627A', '#AEB5C2'),
];
