import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const implementedPaths = [
  "/health/live",
  "/health/ready",
  "/api/v1/info",
  "/api/v1/events",
  "/api/v1/plugins/{name}/manifest",
  "/api/v1/workflows",
  "/api/v1/workflows/analyze",
  "/api/v1/workflows/{id}/source",
  "/api/v1/workflows/{id}/enable",
  "/api/v1/workflows/{id}/disable",
  "/api/v1/executions",
  "/api/v1/executions/{id}"
];

describe("Core OpenAPI contract", () => {
  it("documents every implemented public Core route", async () => {
    const document = JSON.parse(
      await readFile(new URL("../openapi/core-api.openapi.json", import.meta.url), "utf8")
    ) as { openapi: string; paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };

    expect(document.openapi).toBe("3.1.2");
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(implementedPaths));
    expect(document.components.schemas).toHaveProperty("CoreSseEventEnvelope");
    expect(document.components.schemas).toHaveProperty("ApiProblemDetails");
  });

  it("publishes the Core API and Phase 1 schema artifacts", async () => {
    const packageManifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { files: string[]; exports: Record<string, unknown> };
    const artifactPaths = [
      "./schemas/core-sse-event.schema.json",
      "./schemas/connection-context-export.schema.json",
      "./schemas/provider-model-capabilities.schema.json",
      "./schemas/problem-details.schema.json",
      "./openapi/core-api.openapi.json"
    ];

    expect(packageManifest.files).toEqual(expect.arrayContaining(["schemas", "fixtures", "openapi"]));
    expect(Object.keys(packageManifest.exports)).toEqual(expect.arrayContaining(artifactPaths));
  });

  it("references the canonical schemas instead of duplicating their public shapes", async () => {
    const document = JSON.parse(
      await readFile(new URL("../openapi/core-api.openapi.json", import.meta.url), "utf8")
    ) as { components: { schemas: Record<string, unknown> } };

    expect(document.components.schemas).toMatchObject({
      CoreInfo: { $ref: "../schemas/core-info.schema.json" },
      CoreSseEventEnvelope: { $ref: "../schemas/core-sse-event.schema.json" },
      PluginManifest: { $ref: "../schemas/plugin-manifest.schema.json" },
      ApiProblemDetails: { $ref: "../schemas/problem-details.schema.json" }
    });
  });
});
