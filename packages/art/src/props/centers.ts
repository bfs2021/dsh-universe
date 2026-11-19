// The 50 centrepieces, one per room template, each using this floor's data a second time.
import { CENTERS_1 } from './centers-1.ts';
import { CENTERS_2 } from './centers-2.ts';
import { CENTERS_3 } from './centers-3.ts';
import { CENTERS_4 } from './centers-4.ts';
import type { Kit } from './walls.ts';

export const CENTER: Kit = { ...CENTERS_1, ...CENTERS_2, ...CENTERS_3, ...CENTERS_4 };
