import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const script = fs.readFileSync(path.join(process.cwd(), "scripts", "cleanup-dev.ps1"), "utf8");
const code = script
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

describe("npm run clean:dev scope", () => {
  it("picks processes by this folder only, so another repo's in-memory mongod is never matched by name", () => {
    expect(code).toContain('$cmd -like "*$root*"');
    expect(code).toContain('$exe -like "*$root*"');
    expect(code).not.toMatch(/mongodb-memory-server/i);
    expect(code).not.toMatch(/mongodb-binaries/i);
  });

  it("still walks down from those processes to the children they started", () => {
    expect(code).toContain("$ours[[int]$p.ParentProcessId]");
  });

  it("says in its header that the child walk is what catches this repo's mongod", () => {
    const header = script.split(/\r?\n/).filter((line) => line.startsWith("#")).join("\n");
    expect(header).toMatch(/mongod/);
    expect(header).toMatch(/outside this folder/);
    expect(header).not.toMatch(/it is mongodb-memory-server or the mongod that package downloads/);
  });
});
