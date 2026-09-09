import { createKakuneClient } from "@kakune/client";
import type { CoreInfo, PluginManifest } from "@kakune/contracts";
import type { KakuneClientOptions, SseEvent } from "@kakune/client";

export interface KakuneSdkOptions extends KakuneClientOptions {}

export interface KakuneSdk {
  getCoreInfo(): Promise<CoreInfo>;
  getPluginManifest(name: string): Promise<PluginManifest>;
  events(): AsyncIterable<SseEvent>;
}

export function createKakuneSdk(options: KakuneSdkOptions): KakuneSdk {
  const client = createKakuneClient(options);

  return {
    getCoreInfo: () => client.get<CoreInfo>("/api/v1/info"),
    getPluginManifest: (name) => client.get<PluginManifest>(`/api/v1/plugins/${encodeURIComponent(name)}/manifest`),
    events: () => client.events("/api/v1/events")
  };
}

export type { CoreInfo, PluginManifest, SseEvent };
