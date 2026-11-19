import type { UCapabilities, UPlatform } from '@dsh-universe/model';

export const ADAPTER_VERSION = '0.1.0';

/** What DSH 0.2.2-rc.2 gives. Schedules depend on the `schedule` service being there. */
export function dshCapabilities(o: { schedules: boolean }): UCapabilities {
  return {
    approvals: true, schedules: o.schedules, subagents: true, jobs: true, deliverables: true, skills: true,
    memory: false, tokens: true, cost: false, latency: true, sessionTitles: true, retries: true,
    actions: { openSession: true, draftFollowUp: true },
  };
}

export const dshPlatform = (caps: UCapabilities): UPlatform => ({ id: 'dsh', title: 'DSH', adapterVersion: ADAPTER_VERSION, caps });
