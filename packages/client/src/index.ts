export interface KakuneClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
}

export interface KakuneRequestInit extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
}

export interface SseEvent {
  data: string;
  event: string;
  id?: string;
  retry?: number;
}

export class KakuneHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(response: Response, body: unknown) {
    super(`Kakune request failed: ${response.status} ${response.statusText}`);
    this.name = "KakuneHttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
  }
}

export interface KakuneClient {
  request(path: string, init?: KakuneRequestInit): Promise<Response>;
  get<T>(path: string, init?: KakuneRequestInit): Promise<T>;
  events(path: string, init?: KakuneRequestInit): AsyncIterable<SseEvent>;
}

export function createKakuneClient(options: KakuneClientOptions): KakuneClient {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (!fetchImplementation) {
    throw new Error("A Fetch implementation is required to create a Kakune client.");
  }

  const baseUrl = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;

  async function request(path: string, init: KakuneRequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    headers.set("accept", "application/json");

    const response = await fetchImplementation(new URL(path, baseUrl), { ...init, headers });
    if (!response.ok) {
      throw new KakuneHttpError(response, await readErrorBody(response));
    }
    return response;
  }

  return {
    request,
    async get<T>(path: string, init?: KakuneRequestInit) {
      return (await request(path, init)).json() as Promise<T>;
    },
    async *events(path: string, init: KakuneRequestInit = {}) {
      const headers = new Headers(options.headers);
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
      headers.set("accept", "text/event-stream");

      const response = await fetchImplementation(new URL(path, baseUrl), { ...init, headers });
      if (!response.ok) {
        throw new KakuneHttpError(response, await readErrorBody(response));
      }
      if (!response.body) {
        throw new Error("Kakune event response has no body.");
      }
      yield* parseSse(response.body);
    }
  };
}

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;

  const dispatch = (): SseEvent | undefined => {
    if (data.length === 0) return undefined;
    const message = { data: data.join("\n"), event, id, retry };
    event = "message";
    data = [];
    retry = undefined;
    return message;
  };

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line === "") {
          const message = dispatch();
          if (message) yield message;
          continue;
        }
        if (line.startsWith(":")) continue;

        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        let value = separator === -1 ? "" : line.slice(separator + 1);
        if (value.startsWith(" ")) value = value.slice(1);

        if (field === "data") data.push(value);
        if (field === "event") event = value;
        if (field === "id" && !value.includes("\0")) id = value;
        if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
      }
    }

    buffer += decoder.decode();
    if (buffer.endsWith("\r")) buffer = buffer.slice(0, -1);
    if (buffer) {
      const separator = buffer.indexOf(":");
      const field = separator === -1 ? buffer : buffer.slice(0, separator);
      let value = separator === -1 ? "" : buffer.slice(separator + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") data.push(value);
      if (field === "event") event = value;
      if (field === "id" && !value.includes("\0")) id = value;
      if (field === "retry" && /^\d+$/.test(value)) retry = Number(value);
    }
    const message = dispatch();
    if (message) yield message;
  } finally {
    reader.releaseLock();
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  return response.text();
}
