import { createKakuneSdk } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("Kakune SDK", () => {
  it("uses versioned core endpoints", async () => {
    let url = "";
    const sdk = createKakuneSdk({
      baseUrl: "https://api.example.test",
      fetch: (async (input) => {
        url = String(input);
        return Response.json({ apiVersion: "1.0", coreVersion: "0.1.0", capabilities: [] });
      }) as typeof fetch
    });

    await expect(sdk.getCoreInfo()).resolves.toEqual({
      apiVersion: "1.0",
      coreVersion: "0.1.0",
      capabilities: []
    });
    expect(url).toBe("https://api.example.test/api/v1/info");
  });

  it("encodes plugin names in manifest routes", async () => {
    let url = "";
    const sdk = createKakuneSdk({
      baseUrl: "https://api.example.test",
      fetch: (async (input) => {
        url = String(input);
        return Response.json({});
      }) as typeof fetch
    });

    await sdk.getPluginManifest("@kakune/report plugin");
    expect(url).toBe("https://api.example.test/api/v1/plugins/%40kakune%2Freport%20plugin/manifest");
  });
});
