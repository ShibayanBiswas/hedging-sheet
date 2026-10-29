import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

/** Pages and components name the underlying through lib/underlyings.ts and the inputs, never as typed text. */
test("no component or page types an underlying's name", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !full.includes(`${path.sep}api${path.sep}`)) {
        const code = fs
          .readFileSync(full, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/.*$/gm, "$1");
        code.split("\n").forEach((line, i) => {
          if (/\b(Sensex|Nifty)\b/.test(line)) hits.push(`${full}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk("components");
  walk("app");
  expect(hits).toEqual([]);
});
