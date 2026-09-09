import { createKakuneClient, KakuneHttpError, parseSse } from "../src/index.js";
import { describe, expect, it } from "vitest";

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
}

describe("Kakune client", () => {
  it("builds a JSON request with configured headers", async () => {
    let request: Request | undefined;
    const client = createKakuneClient({
      baseUrl: "https://api.example.test",
      headers: { authorization: "Bearer token" },
      fetch: (async (input, init) => {
        request = new Request(input, init);
        return Response.json({ ok: true });
      }) as typeof fetch
    });

    await expect(client.get<{ ok: boolean }>("/v1/info")).resolves.toEqual({ ok: true });
    expect(request?.url).toBe("https://api.example.test/v1/info");
    expect(request?.headers.get("authorization")).toBe("Bearer token");
    expect(request?.headers.get("accept")).toBe("application/json");
  });

  it("preserves structured HTTP error bodies", async () => {
    const client = createKakuneClient({
      baseUrl: "https://api.example.test",
      fetch: (async () =>
        new Response(JSON.stringify({ code: "forbidden" }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "content-type": "application/json" }
        })) as typeof fetch
    });

    await expect(client.get("/v1/info")).rejects.toMatchObject<KakuneHttpError>({
      name: "KakuneHttpError",
      status: 403,
      body: { code: "forbidden" }
    });
  });

  it("parses chunked SSE messages", async () => {
    const events = [];
    for await (const event of parseSse(stream(["id: 4\nevent: up", "date\ndata: one\ndata: two\nretry: 1500\n\n"]))) {
      events.push(event);
    }
    expect(events).toEqual([{ id: "4", event: "update", data: "one\ntwo", retry: 1500 }]);
  });

  it("opens SSE streams with the event media type", async () => {
    let accept: string | null = null;
    const client = createKakuneClient({
      baseUrl: "https://api.example.test",
      fetch: (async (_input, init) => {
        accept = new Headers(init?.headers).get("accept");
        return new Response(stream(["data: ready\n\n"]));
      }) as typeof fetch
    });

    const events = [];
    for await (const event of client.events("/v1/events")) events.push(event);
    expect(accept).toBe("text/event-stream");
    expect(events).toEqual([{ event: "message", data: "ready", id: undefined, retry: undefined }]);
  });
});
