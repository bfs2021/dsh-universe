// The adapter interface. Each adapter turns one platform into the common model.
import type { PlatformId, UCapabilities, UEvent, USnapshot } from '@dsh-universe/model';

export interface ConsentRequest {
  /** Locale keys only: what is read, whether the other tool's configuration changes, how to undo it. */
  readsKey: string;
  changesConfig: boolean;
  undoKey: string;
}

export interface UniverseAdapter {
  readonly platform: PlatformId;
  detect(): Promise<{ present: boolean; version?: string; note?: string }>;
  describeConsent(): ConsentRequest;
  capabilities(): UCapabilities;
  snapshot(day: string): Promise<USnapshot>;
  subscribe(emit: (e: UEvent) => void): () => void;
  stop(): Promise<void>;
}
