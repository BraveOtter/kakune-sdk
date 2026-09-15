#!/usr/bin/env python3
"""Kakune JSON-RPC 2.0 JSONL protocol demonstrator using only the standard library."""

import json
import sys


cancelled_operations: set[str] = set()


def send(message: dict) -> None:
    """stdout is reserved exclusively for one JSON-RPC message per line."""
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def error(request_id: object, code: int, message: str, data: object = None) -> None:
    body: dict[str, object] = {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}
    if data is not None:
        body["error"]["data"] = data
    send(body)


def handle(message: object) -> None:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        error(None, -32600, "Invalid Request")
        return

    method = message["method"]
    request_id = message.get("id")
    params = message.get("params", {})

    if method == "operation/cancel":
        operation_id = params.get("operationId") if isinstance(params, dict) else None
        if not isinstance(operation_id, str):
            error(request_id, -32602, "operationId must be a string")
            return
        cancelled_operations.add(operation_id)
        if "id" in message:
            send({"jsonrpc": "2.0", "id": request_id, "result": {"cancelled": operation_id}})
        return

    if method == "initialize":
        if "id" in message:
            send({"jsonrpc": "2.0", "id": request_id, "result": {"protocolVersion": "1.0", "nodes": ["kakune.python-hello@1"]}})
        return

    if method == "shutdown":
        if "id" in message:
            send({"jsonrpc": "2.0", "id": request_id, "result": {"stopped": True}})
        raise SystemExit(0)

    if method != "node/execute":
        if "id" in message:
            error(request_id, -32601, "Method not found", {"method": method})
        return

    inputs = params.get("inputs") if isinstance(params, dict) else None
    if not isinstance(inputs, dict) or not isinstance(inputs.get("name"), str) or not inputs["name"].strip():
        error(request_id, -32602, "inputs.name must be a non-empty string")
        return

    operation_id = params.get("operationId")
    if isinstance(operation_id, str) and operation_id in cancelled_operations:
        error(request_id, -32800, "Operation cancelled", {"operationId": operation_id})
        return

    if isinstance(operation_id, str):
        send({"jsonrpc": "2.0", "method": "operation/progress", "params": {"operationId": operation_id, "progress": 50}})
    if "id" in message:
        send({"jsonrpc": "2.0", "id": request_id, "result": {"route": "success", "outputs": {"message": f"Hello, {inputs['name']}!"}}})


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        handle(json.loads(line))
    except json.JSONDecodeError:
        error(None, -32700, "Parse error")
    except Exception as exc:  # Keep diagnostic output off the protocol stream.
        print(f"plugin error: {exc}", file=sys.stderr)
        error(None, -32603, "Internal error")
