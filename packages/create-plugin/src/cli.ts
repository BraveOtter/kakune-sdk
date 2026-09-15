#!/usr/bin/env node
import { resolve } from "node:path";
import { createPlugin } from "./index.js";

function usage(): string {
  return "Usage: kakune-create-plugin <directory> --id vendor.plugin [--name text] [--description text]";
}

function readArguments(argv: string[]): { directory: string; id: string; name?: string; description?: string } {
  const [directory, ...flags] = argv;
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error(usage());
    values.set(flag, value);
  }
  const id = values.get("--id");
  if (!directory || !id) throw new Error(usage());
  return { directory: resolve(directory), id, name: values.get("--name"), description: values.get("--description") };
}

try {
  await createPlugin(readArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
