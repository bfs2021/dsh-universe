// Room templates for the machine floor: commands (12 rooms).
// Each is a 12×12 room: a plan type, a back wall, a centrepiece, a kind of workstation, a side room, a corner and
// three floor colours. Tags are the theme vocabulary. All rights reserved.
import { T, type RoomTemplate } from './template.ts';

export const MACHINE_ROOMS: readonly RoomTemplate[] = [
  T('servers', ['code', 'ops', 'data'], 'machine', 0, 'status', 'aisle', 'console', 'cage', 'lockers', '#DDF0F8', '#59627A', '#AEB5C2'),
  T('assembly', ['ops'], 'machine', 2, 'board', 'line', 'bench', 'store', 'lockers', '#F4F1E8', '#FFC928', '#FFF6CF'),
  T('testlab', ['code', 'research'], 'machine', 2, 'chem', 'rig', 'bench', 'cage', 'lockers', '#F4F1E8', '#E5433D', '#FF8A7A'),
  T('buildfarm', ['code'], 'machine', 0, 'status', 'tower', 'console', 'cage', 'lockers', '#E6F7D6', '#2E9E48', '#8BD93E'),
  T('pipeline', ['data'], 'machine', 2, 'board', 'tanks', 'console', 'store', 'lockers', '#DDF0F8', '#19B8A0', '#BFF1EE'),
  T('control', ['ops', 'security'], 'machine', 2, 'video', 'mimic', 'console', 'cage', 'pantry', '#DDF0F8', '#59627A', '#AEB5C2'),
  T('render', ['media', 'design'], 'machine', 3, 'tvwall', 'cube', 'draft', 'booth', 'lounge', '#E9DDF5', '#8E5BE8', '#E9DDF5'),
  T('counting', ['finance'], 'machine', 4, 'vaultw', 'cash', 'carrel', 'store', 'lockers', '#E6F7D6', '#2E9E48', '#8BD93E'),
  T('mailroom', ['admin', 'support', 'sales'], 'machine', 2, 'boxes', 'sorter', 'bench', 'store', 'lockers', '#F4F1E8', '#C9925A', '#FFF6CF'),
  T('presses', ['marketing', 'docs'], 'machine', 2, 'board', 'rotary', 'bench', 'store', 'lockers', '#F4F1E8', '#E5433D', '#FF8A7A'),
  T('robots', ['product', 'ops'], 'machine', 3, 'status', 'cell', 'console', 'cage', 'lockers', '#F4F1E8', '#FFC928', '#FFF6CF'),
  T('simlab', ['research', 'data'], 'machine', 3, 'stars', 'holo', 'console', 'glass', 'lounge', '#DDF0F8', '#1F4FB0', '#7FA8F5'),
];
