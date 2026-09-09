#!/usr/bin/env node
import { resolve } from "node:path";
import { createPlugin } from "./index.js";

function usage(): string {
  return "Usage: kakune-create-plugin <directory> --name @scope/name [--description text]";
}

function readArguments(argv: string[]): { directory: string; name: string; description?: string } {
  const [directory, ...flags] = argv;
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error(usage());
    values.set(flag, value);
  }
  const name = values.get("--name");
  if (!directory || !name) throw new Error(usage());
  return { directory: resolve(directory), name, description: values.get("--description") };
}

try {
  await createPlugin(readArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
