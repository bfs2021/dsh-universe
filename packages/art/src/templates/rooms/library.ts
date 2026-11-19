// Room templates for the library floor: reading and searching (15 rooms).
// Each is a 12×12 room: a plan type, a back wall, a centrepiece, a kind of workstation, a side room, a corner and
// three floor colours. Tags are the theme vocabulary. All rights reserved.
import { T, type RoomTemplate } from './template.ts';

export const LIBRARY_ROOMS: readonly RoomTemplate[] = [
  T('archive', ['docs', 'legal', 'admin'], 'library', 1, 'boxes', 'compactor', 'carrel', 'store', 'lockers', '#F4F1E8', '#8D6B52', '#C9925A'),
  T('ledger', ['finance'], 'library', 4, 'vaultw', 'ledgerdesk', 'carrel', 'store', 'lounge', '#FFF6CF', '#2E9E48', '#8BD93E'),
  T('market', ['finance', 'sales', 'data'], 'library', 0, 'video', 'pit', 'desk', 'glass', 'lounge', '#E9DDF5', '#2F6BDE', '#7FA8F5'),
  T('lab', ['research'], 'library', 2, 'chem', 'island', 'bench', 'store', 'lockers', '#E6F7D6', '#19B8A0', '#BFF1EE'),
  T('maproom', ['sales', 'ops', 'marketing'], 'library', 3, 'mapw', 'globe', 'draft', 'store', 'pantry', '#DDF0F8', '#2F6BDE', '#7FA8F5'),
  T('lounge', ['docs', 'hr'], 'library', 1, 'books', 'hearth', 'cafe', 'glass', 'pantry', '#FFE9F3', '#8E5BE8', '#E9DDF5'),
  T('caselib', ['legal'], 'library', 3, 'books', 'reading', 'carrel', 'glass', 'lounge', '#FFF6CF', '#8D6B52', '#C9925A'),
  T('observatory', ['data', 'research'], 'library', 3, 'stars', 'scope', 'console', 'cage', 'lounge', '#DDF0F8', '#1F4FB0', '#7FA8F5'),
  T('newsroom', ['media', 'marketing'], 'library', 2, 'tvwall', 'anchor', 'desk', 'booth', 'pantry', '#DDF0F8', '#E5433D', '#FF8A7A'),
  T('reviewnook', ['code'], 'library', 2, 'queue', 'reviewtable', 'desk', 'glass', 'pantry', '#E6F7D6', '#2E9E48', '#8BD93E'),
  T('speclib', ['product', 'design'], 'library', 1, 'board', 'plinth', 'draft', 'store', 'lounge', '#F4F1E8', '#8E5BE8', '#E9DDF5'),
  T('secops', ['security', 'ops'], 'library', 2, 'status', 'soc', 'console', 'cage', 'lockers', '#DDF0F8', '#E5433D', '#FF8A7A'),
  T('survey', ['research', 'marketing'], 'library', 0, 'charts', 'poll', 'desk', 'glass', 'pantry', '#FFF6CF', '#FF8A2B', '#FFC928'),
  T('cafe', ['support', 'hr'], 'library', 4, 'menu', 'bar', 'cafe', 'glass', 'lounge', '#FFF6CF', '#A8553A', '#C9925A'),
  T('scanbay', ['docs', 'admin', 'legal'], 'library', 2, 'boxes', 'scanner', 'bench', 'store', 'lockers', '#F4F1E8', '#19B8A0', '#BFF1EE'),
];
