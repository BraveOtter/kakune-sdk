import { createKakuneSdk } from "../src/index.js";
import { describe, expect, it } from "vitest";

function createSdk(response: unknown) {
  let request: Request | undefined;
  const sdk = createKakuneSdk({
    baseUrl: "https://api.example.test",
    fetch: (async (input, init) => {
      request = new Request(input, init);
      return Response.json(response);
    }) as typeof fetch
  });

  return { sdk, request: () => request };
}

describe("Kakune SDK", () => {
  it("uses versioned core endpoints", async () => {
    let url = "";
    const sdk = createKakuneSdk({
      baseUrl: "https://api.example.test",
      fetch: (async (input) => {
        url = String(input);
        return Response.json({ apiVersion: "1.0", coreVersion: "0.1.0", coreId: "ff0a2b20-f31b-4d3d-b92a-05e19f4c0874", capabilities: [] });
      }) as typeof fetch
    });

    await expect(sdk.getCoreInfo()).resolves.toEqual({
      apiVersion: "1.0",
      coreVersion: "0.1.0",
      coreId: "ff0a2b20-f31b-4d3d-b92a-05e19f4c0874",
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

  it("lists workflows from the items envelope", async () => {
    const workflows = [{ id: "report", name: "Report", status: "enabled" as const, updatedAt: "2026-09-09T00:00:00Z" }];
    const { sdk, request } = createSdk({ items: workflows });

    await expect(sdk.listWorkflows()).resolves.toEqual(workflows);
    expect(request()?.url).toBe("https://api.example.test/api/v1/workflows");
    expect(request()?.method).toBe("GET");
    expect(request()?.body).toBeNull();
  });

  it("posts workflow source for analysis", async () => {
    const source = "apiVersion: kakune/v1\nkind: Workflow";
    const { sdk, request } = createSdk({ diagnostics: [] });

    await expect(sdk.analyzeWorkflow(source)).resolves.toEqual({ diagnostics: [] });
    expect(request()?.url).toBe("https://api.example.test/api/v1/workflows/analyze");
    expect(request()?.method).toBe("POST");
    expect(request()?.headers.get("content-type")).toBe("application/json");
    await expect(request()?.text()).resolves.toBe(JSON.stringify({ source }));
  });

  it("posts workflow source to create a workflow", async () => {
    const source = "kind: Workflow";
    const workflow = { id: "report", name: "Report", status: "disabled" as const, updatedAt: "2026-09-09T00:00:00Z" };
    const { sdk, request } = createSdk(workflow);

    await expect(sdk.createWorkflow(source)).resolves.toEqual(workflow);
    expect(request()?.url).toBe("https://api.example.test/api/v1/workflows");
    expect(request()?.method).toBe("POST");
    await expect(request()?.text()).resolves.toBe(JSON.stringify({ source }));
  });

  it("gets workflow source with an encoded workflow ID", async () => {
    const { sdk, request } = createSdk({ id: "report/a b", source: "kind: Workflow" });

    await expect(sdk.getWorkflowSource("report/a b")).resolves.toEqual({ id: "report/a b", source: "kind: Workflow" });
    expect(request()?.url).toBe("https://api.example.test/api/v1/workflows/report%2Fa%20b/source");
    expect(request()?.method).toBe("GET");
    expect(request()?.body).toBeNull();
  });

  it("puts workflow source with an encoded workflow ID", async () => {
    const source = "kind: Workflow\nmetadata: {}";
    const workflow = { id: "report/a b", name: "Report", status: "enabled" as const, updatedAt: "2026-09-09T00:00:00Z" };
    const { sdk, request } = createSdk(workflow);

    await expect(sdk.saveWorkflowSource("report/a b", source, "original-revision")).resolves.toEqual(workflow);
    expect(request()?.url).toBe("https://api.example.test/api/v1/workflows/report%2Fa%20b/source");
    expect(request()?.method).toBe("PUT");
    expect(request()?.headers.get("if-match")).toBe("original-revision");
    await expect(request()?.text()).resolves.toBe(JSON.stringify({ source }));
  });

  it("posts workflow enable and disable actions with encoded IDs", async () => {
    const requests: Request[] = [];
    const sdk = createKakuneSdk({
      baseUrl: "https://api.example.test",
      fetch: (async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ id: "report/a b", status: "enabled" });
      }) as typeof fetch
    });

    await sdk.setWorkflowEnabled("report/a b", true);
    await sdk.setWorkflowEnabled("report/a b", false);

    expect(requests.map((request) => ({ url: request.url, method: request.method, body: request.body }))).toEqual([
      { url: "https://api.example.test/api/v1/workflows/report%2Fa%20b/enable", method: "POST", body: null },
      { url: "https://api.example.test/api/v1/workflows/report%2Fa%20b/disable", method: "POST", body: null }
    ]);
  });

  it("posts a workflow ID to create an execution", async () => {
    const execution = { id: "run-1", workflowName: "Report", status: "queued", createdAt: "2026-09-09T00:00:00Z" };
    const { sdk, request } = createSdk(execution);

    await expect(sdk.createExecution("report/a b")).resolves.toEqual(execution);
    expect(request()?.url).toBe("https://api.example.test/api/v1/executions");
    expect(request()?.method).toBe("POST");
    expect(request()?.headers.get("content-type")).toBe("application/json");
    await expect(request()?.text()).resolves.toBe(JSON.stringify({ workflowId: "report/a b" }));
  });

  it("lists executions from the items envelope", async () => {
    const executions = [{ id: "run-1", workflowName: "Report", status: "completed", createdAt: "2026-09-09T00:00:00Z" }];
    const { sdk, request } = createSdk({ items: executions });

    await expect(sdk.listExecutions()).resolves.toEqual(executions);
    expect(request()?.url).toBe("https://api.example.test/api/v1/executions");
    expect(request()?.method).toBe("GET");
    expect(request()?.body).toBeNull();
  });

  it("gets execution detail with an encoded execution ID", async () => {
    const detail = {
      execution: { id: "run/a b", workflowName: "Report", status: "completed", createdAt: "2026-09-09T00:00:00Z" },
      nodes: [{ nodeId: "build", status: "completed" }]
    };
    const { sdk, request } = createSdk(detail);

    await expect(sdk.getExecution("run/a b")).resolves.toEqual(detail);
    expect(request()?.url).toBe("https://api.example.test/api/v1/executions/run%2Fa%20b");
    expect(request()?.method).toBe("GET");
    expect(request()?.body).toBeNull();
  });
});
