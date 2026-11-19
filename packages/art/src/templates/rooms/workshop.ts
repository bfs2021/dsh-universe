// Room templates for the workshop floor: editing (13 rooms).
// Each is a 12×12 room: a plan type, a back wall, a centrepiece, a kind of workstation, a side room, a corner and
// three floor colours. Tags are the theme vocabulary. All rights reserved.
import { T, type RoomTemplate } from './template.ts';

export const WORKSHOP_ROOMS: readonly RoomTemplate[] = [
  T('writers', ['docs', 'marketing', 'media'], 'workshop', 2, 'queue', 'story', 'desk', 'glass', 'pantry', '#FFF6CF', '#FF8A2B', '#FFC928'),
  T('studio', ['design'], 'workshop', 3, 'mood', 'layout', 'draft', 'booth', 'pantry', '#FFE9F3', '#FF4FA3', '#FFE9F3'),
  T('codeshop', ['code'], 'workshop', 0, 'status', 'kiosk', 'desk', 'cage', 'lounge', '#E6F7D6', '#2E9E48', '#8BD93E'),
  T('sheets', ['finance', 'data'], 'workshop', 0, 'charts', 'grid', 'desk', 'glass', 'pantry', '#DDF0F8', '#19B8A0', '#BFF1EE'),
  T('contracts', ['legal'], 'workshop', 4, 'books', 'sign', 'carrel', 'glass', 'lounge', '#FFF6CF', '#A8553A', '#C9925A'),
  T('printshop', ['marketing', 'docs', 'admin'], 'workshop', 2, 'board', 'press', 'bench', 'store', 'lockers', '#F4F1E8', '#22C3E6', '#BFF1EE'),
  T('maker', ['design', 'product'], 'workshop', 3, 'mood', 'printer3d', 'bench', 'store', 'lockers', '#F4F1E8', '#FF8A2B', '#FFC928'),
  T('slides', ['sales', 'marketing', 'product'], 'workshop', 1, 'tvwall', 'stage', 'draft', 'booth', 'pantry', '#E9DDF5', '#8E5BE8', '#E9DDF5'),
  T('translate', ['docs', 'support'], 'workshop', 3, 'mapw', 'booths', 'carrel', 'glass', 'lounge', '#DDF0F8', '#2F6BDE', '#7FA8F5'),
  T('videoedit', ['media'], 'workshop', 0, 'tvwall', 'suite', 'console', 'booth', 'lounge', '#E9DDF5', '#59627A', '#AEB5C2'),
  T('forms', ['admin', 'hr', 'finance'], 'workshop', 4, 'boxes', 'counterf', 'desk', 'store', 'pantry', '#F4F1E8', '#2F6BDE', '#7FA8F5'),
  T('quotes', ['sales', 'finance'], 'workshop', 4, 'video', 'tickerpole', 'desk', 'glass', 'lounge', '#FFF6CF', '#FF8A2B', '#FFC928'),
  T('cleaning', ['data', 'ops'], 'workshop', 2, 'charts', 'washer', 'bench', 'store', 'lockers', '#DDF0F8', '#22C3E6', '#BFF1EE'),
];
