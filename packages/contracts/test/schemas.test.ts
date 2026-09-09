import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const schemaNames = [
  "core-info",
  "workflow",
  "plugin-manifest",
  "plugin-json-rpc-message"
] as const;

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

describe("canonical schemas", () => {
  for (const name of schemaNames) {
    it(`accepts the ${name} fixture`, async () => {
      const [schema, fixture] = await Promise.all([
        readJson(`../schemas/${name}.schema.json`),
        readJson(`../fixtures/${name}.valid.json`)
      ]);
      const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
      expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    });

    it(`rejects the invalid ${name} fixture`, async () => {
      const [schema, fixture] = await Promise.all([
        readJson(`../schemas/${name}.schema.json`),
        readJson(`../fixtures/${name}.invalid.json`)
      ]);
      const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
      expect(validate(fixture)).toBe(false);
    });
  }
});
