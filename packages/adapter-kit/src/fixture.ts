// The fixture format: a day of one platform as model events, with the moment "now" the fixture was taken at.
import type { PlacementState, UEvent, UPlatform } from '@dsh-universe/model';

export interface Fixture { platform: UPlatform; day: string; now: number; events: UEvent[]; /** The placement the host would keep (mock data). */ placement?: PlacementState }
